import { shiftMonth } from '../shared/finance-month.js';
const sessionMeta = "s.id, s.record_id AS recordId, r.name AS userName, s.title, s.session_number AS sessionNumber, DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date, TIME_FORMAT(s.start_time, '%H:%i') AS time, s.status, s.version";
const planColumns = "p.id, p.session_id AS sessionId, p.materials, p.objectives, p.execution_plan AS executionPlan, p.observations, p.version, p.updated_at AS updatedAt, s.title, s.session_number AS sessionNumber, DATE_FORMAT(s.session_date, '%Y-%m-%d') AS date, TIME_FORMAT(s.start_time, '%H:%i') AS time, s.status AS sessionStatus";
export function schedulingRepository(pool) {
  return {
    async calendarSessions(therapistId, month, page) {
      const params = [therapistId, `${month}-01`, `${shiftMonth(month, 1)}-01`];
      const where = 'r.therapist_id = ? AND s.start_time IS NOT NULL AND s.session_date >= ? AND s.session_date < ?';
      const [count] = await pool.execute(`SELECT COUNT(*) AS total FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE ${where}`, params);
      const [sessions] = await pool.query(`SELECT ${sessionMeta} FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE ${where} ORDER BY s.session_date, s.start_time, s.id LIMIT 100 OFFSET ?`, [...params, (page - 1) * 100]);
      return { sessions, total: Number(count[0].total), page, pageSize: 100 };
    },
    async findAppointment(therapistId, id) {
      const [rows] = await pool.execute(`SELECT ${sessionMeta} FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE s.id = ? AND r.therapist_id = ?`, [id, therapistId]);
      return rows[0];
    },
    async updateAppointment(therapistId, id, version, appointment) {
      const [result] = await pool.execute("UPDATE clinical_sessions s JOIN clinical_records r ON r.id = s.record_id SET s.title = ?, s.session_date = ?, s.start_time = ?, s.version = s.version + 1 WHERE s.id = ? AND r.therapist_id = ? AND s.version = ?", [appointment.title, appointment.date, appointment.time, id, therapistId, version]);
      return result.affectedRows ? this.findAppointment(therapistId, id) : null;
    },
    async sessionChoices(therapistId, recordId, page) {
      const [count] = await pool.execute('SELECT COUNT(*) AS total FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE r.therapist_id = ? AND r.id = ? AND s.start_time IS NOT NULL', [therapistId, recordId]);
      const [sessions] = await pool.query(`SELECT ${sessionMeta} FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE r.therapist_id = ? AND r.id = ? AND s.start_time IS NOT NULL ORDER BY s.session_date DESC, s.start_time DESC, s.id LIMIT 20 OFFSET ?`, [therapistId, recordId, (page - 1) * 20]);
      return { sessions, total: Number(count[0].total), page, pageSize: 20 };
    },
    async listPlans(therapistId, recordId, page) {
      const [count] = await pool.execute('SELECT COUNT(*) AS total FROM clinical_plans p JOIN clinical_records r ON r.id = p.record_id WHERE r.therapist_id = ? AND r.id = ?', [therapistId, recordId]);
      const [plans] = await pool.query(`SELECT ${planColumns} FROM clinical_plans p JOIN clinical_records r ON r.id = p.record_id JOIN clinical_sessions s ON s.id = p.session_id AND s.record_id = p.record_id WHERE r.therapist_id = ? AND r.id = ? ORDER BY p.updated_at DESC, p.id DESC LIMIT 20 OFFSET ?`, [therapistId, recordId, (page - 1) * 20]);
      return { plans, total: Number(count[0].total), page, pageSize: 20 };
    },
    async findPlan(therapistId, recordId, id) {
      const [rows] = await pool.execute(`SELECT ${planColumns} FROM clinical_plans p JOIN clinical_records r ON r.id = p.record_id JOIN clinical_sessions s ON s.id = p.session_id AND s.record_id = p.record_id WHERE p.id = ? AND r.id = ? AND r.therapist_id = ?`, [id, recordId, therapistId]);
      return rows[0];
    },
    async createPlan(therapistId, recordId, id, plan) {
      const [result] = await pool.execute('INSERT INTO clinical_plans (id, record_id, session_id, materials, objectives, execution_plan, observations) SELECT ?, r.id, s.id, ?, ?, ?, ? FROM clinical_sessions s JOIN clinical_records r ON r.id = s.record_id WHERE s.id = ? AND r.id = ? AND r.therapist_id = ? AND s.start_time IS NOT NULL', [id, plan.materials, JSON.stringify(plan.objectives), plan.executionPlan, plan.observations, plan.sessionId, recordId, therapistId]);
      return result.affectedRows ? this.findPlan(therapistId, recordId, id) : null;
    },
    async updatePlan(therapistId, recordId, id, version, plan) {
      const [result] = await pool.execute('UPDATE clinical_plans p JOIN clinical_records r ON r.id = p.record_id JOIN clinical_sessions s ON s.id = ? AND s.record_id = r.id AND s.start_time IS NOT NULL SET p.session_id = s.id, p.materials = ?, p.objectives = ?, p.execution_plan = ?, p.observations = ?, p.version = p.version + 1 WHERE p.id = ? AND r.id = ? AND r.therapist_id = ? AND p.version = ?', [plan.sessionId, plan.materials, JSON.stringify(plan.objectives), plan.executionPlan, plan.observations, id, recordId, therapistId, version]);
      return result.affectedRows ? this.findPlan(therapistId, recordId, id) : null;
    },
  };
}
