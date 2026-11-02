import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { shiftMonth } from '../shared/finance-month.js';
import { schedulingRepository } from './scheduling-db.js';
const recordColumns = {
  name: 'name', age: 'age', address: 'address', medicalHistory: 'medical_history', medications: 'medications', chronicConditions: 'chronic_conditions', routines: 'routines', visibleDifficulties: 'visible_difficulties', familyEnvironment: 'family_environment', housingObservation: 'housing_observation', goals: 'goals', skillsToReinforce: 'skills_to_reinforce',
};
const recordSelect = 'id, version, created_at AS createdAt, updated_at AS updatedAt, ' + Object.entries(recordColumns).map(([key, column]) => `${column} AS ${key}`).join(', ');
export function createRepository(env) {
  const pool = mysql.createPool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3307), user: env.DB_USER || 'espacio_to', password: env.DB_PASSWORD || '', database: env.DB_NAME || 'espacio_to', connectionLimit: 10, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true });
  return {
    async initialize() {
      const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await pool.query(statement);
      const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'picture_url'");
      if (!columns.length) await pool.query('ALTER TABLE users ADD COLUMN picture_url VARCHAR(2048) NULL AFTER name');
      const [googleColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'google_id'");
      if (googleColumns[0].Null === 'NO') await pool.query('ALTER TABLE users MODIFY google_id VARCHAR(255) NULL');
      for (const [name, definition] of [['local_email', 'VARCHAR(320) NULL UNIQUE'], ['password_hash', 'VARCHAR(512) NULL']]) {
        const [existing] = await pool.query('SHOW COLUMNS FROM users LIKE ?', [name]);
        if (!existing.length) await pool.query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
      }
      const [sessionColumns] = await pool.query("SHOW COLUMNS FROM clinical_sessions LIKE 'amount'");
      if (!sessionColumns.length) await pool.query('ALTER TABLE clinical_sessions ADD COLUMN amount INT UNSIGNED NULL AFTER session_date');
      const [versionColumns] = await pool.query("SHOW COLUMNS FROM clinical_sessions LIKE 'version'");
      if (!versionColumns.length) await pool.query('ALTER TABLE clinical_sessions ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER amount');
      for (const [name, definition] of [['title', "VARCHAR(200) NOT NULL DEFAULT ''"], ['session_number', 'INT UNSIGNED NULL'], ['start_time', 'TIME NULL'], ['status', "ENUM('scheduled', 'completed') NOT NULL DEFAULT 'completed'"]]) {
        const [existing] = await pool.query('SHOW COLUMNS FROM clinical_sessions LIKE ?', [name]);
        if (!existing.length) await pool.query(`ALTER TABLE clinical_sessions ADD COLUMN ${name} ${definition}`);
      }
      await pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
    },
    async ping() { await pool.query('SELECT 1'); },
    async upsertUser({ googleId, email, name, picture }) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [found] = await connection.execute('SELECT id FROM users WHERE google_id = ? FOR UPDATE', [googleId]);
        if (!found.length) {
          const [existing] = await connection.execute('SELECT id FROM users WHERE LOWER(email) = ? FOR UPDATE', [email.toLowerCase()]);
          if (existing.length) throw Object.assign(new Error('Account exists'), { code: 'ACCOUNT_EXISTS' });
          await connection.execute('INSERT INTO users (google_id, email, name, picture_url) VALUES (?, ?, ?, ?)', [googleId, email, name, picture]);
        } else await connection.execute('UPDATE users SET email = ?, name = ?, picture_url = ? WHERE id = ?', [email, name, picture, found[0].id]);
        const [rows] = await connection.execute('SELECT id, name, email, picture_url AS picture FROM users WHERE google_id = ?', [googleId]);
        await connection.commit(); return rows[0];
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async createLocalUser({ name, email, passwordHash }) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [found] = await connection.execute('SELECT id FROM users WHERE LOWER(email) = ? OR local_email = ? FOR UPDATE', [email, email]);
        if (found.length) throw Object.assign(new Error('Account exists'), { code: 'ACCOUNT_EXISTS' });
        const [result] = await connection.execute('INSERT INTO users (name, email, local_email, password_hash) VALUES (?, ?, ?, ?)', [name, email, email, passwordHash]);
        const [rows] = await connection.execute('SELECT id, name, email, picture_url AS picture FROM users WHERE id = ?', [result.insertId]);
        await connection.commit(); return rows[0];
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async findLocalUser(email) {
      const [rows] = await pool.execute('SELECT id, name, email, picture_url AS picture, password_hash AS passwordHash FROM users WHERE local_email = ?', [email]);
      return rows[0];
    },
    async localAccount(userId) {
      const [rows] = await pool.execute('SELECT local_email AS localEmail, password_hash AS passwordHash FROM users WHERE id = ?', [userId]); return rows[0];
    },
    async setLocalPassword(userId, email, passwordHash, previousHash, currentToken) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute('UPDATE users SET local_email = ?, password_hash = ? WHERE id = ? AND password_hash <=> ?', [email, passwordHash, userId, previousHash || null]);
        if (!result.affectedRows) { await connection.rollback(); return false; }
        const tokenHash = createHash('sha256').update(currentToken).digest('hex');
        await connection.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, tokenHash]);
        await connection.commit(); return true;
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async createSession(userId, hash, expiresAt) {
      await pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
      await pool.execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [hash, userId, expiresAt]);
    },
    async findSession(hash) {
      const [rows] = await pool.execute('SELECT u.id, u.name, u.email, u.picture_url AS picture FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()', [hash]);
      return rows[0];
    },
    async deleteSession(hash) { await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [hash]); },
    async listRecords(therapistId, search, page) {
      // LOCATE treats search input as literal text rather than SQL wildcard syntax.
      const where = 'therapist_id = ? AND (? = \'\' OR LOCATE(?, name) > 0)';
      const params = [therapistId, search, search];
      const [count] = await pool.execute(`SELECT COUNT(*) AS total FROM clinical_records WHERE ${where}`, params);
      const [rows] = await pool.query(`SELECT id, name, age, address, updated_at AS updatedAt FROM clinical_records WHERE ${where} ORDER BY name, id LIMIT 20 OFFSET ?`, [...params, (page - 1) * 20]);
      return { records: rows, total: Number(count[0].total), page, pageSize: 20 };
    },
    async findRecord(therapistId, id) {
      const [rows] = await pool.execute(`SELECT ${recordSelect} FROM clinical_records WHERE id = ? AND therapist_id = ?`, [id, therapistId]);
      return rows[0];
    },
    async createRecord(therapistId, id, record) {
      const columns = Object.values(recordColumns);
      const values = Object.keys(recordColumns).map(key => record[key]);
      await pool.execute(`INSERT INTO clinical_records (id, therapist_id, ${columns.join(', ')}) VALUES (?, ?, ${columns.map(() => '?').join(', ')})`, [id, therapistId, ...values]);
      return this.findRecord(therapistId, id);
    },
    async updateRecord(therapistId, id, version, record) {
      const values = Object.keys(recordColumns).map(key => record[key]);
      const [result] = await pool.execute(`UPDATE clinical_records SET ${Object.values(recordColumns).map(column => `${column} = ?`).join(', ')}, version = version + 1 WHERE id = ? AND therapist_id = ? AND version = ?`, [...values, id, therapistId, version]);
      return result.affectedRows ? this.findRecord(therapistId, id) : null;
    },
    async listClinicalSessions(therapistId, recordId, page) {
      const where = 's.record_id = ? AND r.therapist_id = ?';
      const params = [recordId, therapistId];
      const [count] = await pool.execute(`SELECT COUNT(*) AS total FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE ${where}`, params);
      const [rows] = await pool.query(`SELECT s.id, s.title, s.session_number AS sessionNumber, TIME_FORMAT(s.start_time, '%H:%i') AS time, s.status, DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date, s.amount, s.version, s.activities, s.objectives, s.observations, s.next_steps AS nextSteps, s.created_at AS createdAt FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE ${where} ORDER BY s.session_date DESC, s.created_at DESC, s.id DESC LIMIT 20 OFFSET ?`, [...params, (page - 1) * 20]);
      return { sessions: rows, total: Number(count[0].total), page, pageSize: 20 };
    },
    async createClinicalSession(therapistId, recordId, id, session) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [owned] = await connection.execute('SELECT id FROM clinical_records WHERE id = ? AND therapist_id = ? FOR UPDATE', [recordId, therapistId]);
        if (!owned.length) { await connection.rollback(); return null; }
        const [count] = await connection.execute('SELECT GREATEST(COALESCE(MAX(session_number),0), COUNT(*)) + 1 AS nextNumber FROM clinical_sessions WHERE record_id = ?', [recordId]);
        const number = Number(count[0].nextNumber);
        await connection.execute('INSERT INTO clinical_sessions (id, record_id, session_date, title, session_number, start_time, status, amount, activities, objectives, observations, next_steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, recordId, session.date, session.title || `Sesión número ${number}`, number, session.time || null, session.status || 'completed', session.amount ?? null, session.activities || '', session.objectives || '', session.observations || '', session.nextSteps || '']);
        await connection.commit();
        return this.findClinicalSession(therapistId, recordId, id);
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async findClinicalSession(therapistId, recordId, id) {
      const [rows] = await pool.execute("SELECT s.id, s.title, s.session_number AS sessionNumber, TIME_FORMAT(s.start_time, '%H:%i') AS time, s.status, DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date, s.amount, s.version, s.activities, s.objectives, s.observations, s.next_steps AS nextSteps FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE s.id = ? AND s.record_id = ? AND r.therapist_id = ?", [id, recordId, therapistId]);
      return rows[0];
    },
    async updateClinicalSession(therapistId, recordId, id, version, session) {
      const [result] = await pool.execute("UPDATE clinical_sessions s JOIN clinical_records r ON r.id = s.record_id SET s.title = COALESCE(?, s.title), s.start_time = COALESCE(?, s.start_time), s.status = 'completed', s.session_date = ?, s.amount = ?, s.activities = ?, s.objectives = ?, s.observations = ?, s.next_steps = ?, s.version = s.version + 1 WHERE s.id = ? AND s.record_id = ? AND r.therapist_id = ? AND s.version = ?", [session.title ?? null, session.time || null, session.date, session.amount, session.activities, session.objectives, session.observations, session.nextSteps, id, recordId, therapistId, version]);
      return result.affectedRows ? this.findClinicalSession(therapistId, recordId, id) : null;
    },
    async reportSources(therapistId, recordId, from, to) {
      const [rows] = await pool.query("SELECT s.id, s.version, DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date, s.activities, s.objectives, s.observations, s.next_steps AS nextSteps FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE r.therapist_id = ? AND s.status = 'completed' AND s.record_id = ? AND (? IS NULL OR s.session_date >= ?) AND (? IS NULL OR s.session_date <= ?) ORDER BY s.session_date, s.created_at, s.id LIMIT 201", [therapistId, recordId, from, from, to, to]);
      return rows.map((row, index) => ({ number: index + 1, ...row }));
    },
    async listReports(therapistId, recordId, page) {
      const [count] = await pool.execute('SELECT COUNT(*) AS total FROM clinical_reports p JOIN clinical_records r ON r.id = p.record_id WHERE p.record_id = ? AND r.therapist_id = ?', [recordId, therapistId]);
      const [reports] = await pool.query("SELECT p.id, p.title, p.status, p.version, DATE_FORMAT(p.period_start, '%Y-%m-%d') AS periodStart, DATE_FORMAT(p.period_end, '%Y-%m-%d') AS periodEnd, JSON_LENGTH(p.source_snapshot) AS sessionCount, p.created_at AS createdAt FROM clinical_reports p JOIN clinical_records r ON r.id = p.record_id WHERE p.record_id = ? AND r.therapist_id = ? ORDER BY p.created_at DESC, p.id DESC LIMIT 20 OFFSET ?", [recordId, therapistId, (page - 1) * 20]);
      return { reports, total: Number(count[0].total), page, pageSize: 20 };
    },
    async findReport(therapistId, recordId, id) {
      const [rows] = await pool.execute("SELECT p.id, p.title, p.status, p.version, p.content, p.source_snapshot AS sources, p.model, DATE_FORMAT(p.period_start, '%Y-%m-%d') AS periodStart, DATE_FORMAT(p.period_end, '%Y-%m-%d') AS periodEnd, p.reviewed_at AS reviewedAt, p.created_at AS createdAt, p.updated_at AS updatedAt FROM clinical_reports p JOIN clinical_records r ON r.id = p.record_id WHERE p.id = ? AND p.record_id = ? AND r.therapist_id = ?", [id, recordId, therapistId]);
      return rows[0];
    },
    async createReport(therapistId, recordId, id, { title, sources, content, model }) {
      const [result] = await pool.execute('INSERT INTO clinical_reports (id, record_id, title, period_start, period_end, source_snapshot, generated_content, content, model) SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM clinical_records WHERE id = ? AND therapist_id = ?', [id, title, sources[0].date, sources.at(-1).date, JSON.stringify(sources), JSON.stringify(content), JSON.stringify(content), model, recordId, therapistId]);
      return result.affectedRows ? this.findReport(therapistId, recordId, id) : null;
    },
    async updateReport(therapistId, recordId, id, { title, content, status, version }) {
      const [result] = await pool.execute("UPDATE clinical_reports p JOIN clinical_records r ON r.id = p.record_id SET p.title = ?, p.content = ?, p.status = ?, p.reviewed_at = IF(? = 'reviewed', UTC_TIMESTAMP(), NULL), p.version = p.version + 1 WHERE p.id = ? AND p.record_id = ? AND r.therapist_id = ? AND p.version = ?", [title, JSON.stringify(content), status, status, id, recordId, therapistId, version]);
      return result.affectedRows ? this.findReport(therapistId, recordId, id) : null;
    },
    async getFinances(therapistId, month, page) {
      const year = Number(month.slice(0, 4));
      const connection = await pool.getConnection();
      try {
        // All figures come from the same snapshot, including the paginated detail.
        await connection.beginTransaction();
        const [monthly] = await connection.execute(`SELECT DATE_FORMAT(s.session_date, '%Y-%m') AS month, COALESCE(SUM(s.amount), 0) AS totalAmount, COUNT(*) AS sessionCount, COUNT(DISTINCT r.id) AS userCount, SUM(s.amount IS NULL) AS unpricedSessions FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE r.therapist_id = ? AND s.status = 'completed' AND s.session_date >= ? AND s.session_date < ? GROUP BY DATE_FORMAT(s.session_date, '%Y-%m') ORDER BY month`, [therapistId, `${year}-01-01`, `${year + 1}-01-01`]);
        const yearMonths = Array.from({ length: 12 }, (_, index) => {
          const key = `${year}-${String(index + 1).padStart(2, '0')}`;
          const row = monthly.find(row => row.month === key);
          return { month: key, totalAmount: Number(row?.totalAmount || 0), sessionCount: Number(row?.sessionCount || 0), userCount: Number(row?.userCount || 0), unpricedSessions: Number(row?.unpricedSessions || 0) };
        });
        const [rows] = await connection.query(`SELECT r.id, r.name, COUNT(*) AS sessionCount, COALESCE(SUM(s.amount), 0) AS totalAmount, SUM(s.amount IS NULL) AS unpricedSessions FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE r.therapist_id = ? AND s.status = 'completed' AND s.session_date >= ? AND s.session_date < ? GROUP BY r.id, r.name ORDER BY totalAmount DESC, r.name, r.id LIMIT 20 OFFSET ?`, [therapistId, `${month}-01`, `${shiftMonth(month, 1)}-01`, (page - 1) * 20]);
        await connection.commit();
        const selected = yearMonths.find(row => row.month === month);
        const { month: _, ...summary } = selected;
        return { month, currency: 'CLP', summary, yearMonths, users: rows.map(row => ({ ...row, sessionCount: Number(row.sessionCount), totalAmount: Number(row.totalAmount), unpricedSessions: Number(row.unpricedSessions) })), totalUsers: summary.userCount, page, pageSize: 20 };
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    ...schedulingRepository(pool),
    async close() { await pool.end(); },
  };
}
