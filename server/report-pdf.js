import { PDFDocument } from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { reportFields } from '../shared/report-fields.js';
const dateLabel = value => new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
export function createReportPdf(report, record, therapist) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 66, bottom: 65, left: 54, right: 54 }, bufferPages: true, font: fileURLToPath(new URL('./fonts/DejaVuSans.ttf', import.meta.url)), info: { Title: report.title, Author: therapist.name || 'Espacio TO', Subject: 'Informe de terapia ocupacional' } });
    doc.registerFont('Body', fileURLToPath(new URL('./fonts/DejaVuSans.ttf', import.meta.url)));
    doc.registerFont('Heading', fileURLToPath(new URL('./fonts/DejaVuSans-Bold.ttf', import.meta.url)));
    const chunks = []; doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const width = doc.page.width - 108;
    const heading = text => { if (doc.y > doc.page.height - 125) doc.addPage(); doc.moveDown(.6).font('Heading').fontSize(11).fillColor('#376b53').text(text, 54, doc.y, { width }); doc.moveDown(.5); };
    const paragraph = text => doc.font('Body').fontSize(10).fillColor('#20313a').text(text, 54, doc.y, { width, lineGap: 4, paragraphGap: 5 });
    doc.font('Heading').fontSize(11).fillColor('#376b53').text('ESPACIO TO', 54, doc.y);
    doc.moveDown(.8).fontSize(21).fillColor('#20313a').text(report.title, { width });
    doc.moveDown(.7).font('Heading').fontSize(9).fillColor('#376b53').text(report.status === 'reviewed' ? 'REVISADO POR TERAPEUTA' : 'BORRADOR - PENDIENTE DE REVISIÓN');
    doc.moveDown(1); paragraph(`Usuario: ${record.name}\nTerapeuta: ${therapist.name || 'Terapeuta'}\nPeríodo: ${dateLabel(report.periodStart)} al ${dateLabel(report.periodEnd)}\nSesiones incluidas: ${report.sources.length}`);
    doc.moveDown(.5); paragraph('Documento elaborado con asistencia de IA a partir de las notas seleccionadas. El contenido requiere revisión profesional.');
    for (const field of reportFields) {
      heading(field.label); paragraph(report.content[field.key].text);
      const refs = report.content[field.key].sources;
      if (refs.length) { doc.moveDown(.3); doc.font('Body').fontSize(8).fillColor('#626f77').text(`Sesiones de respaldo: ${refs.join(', ')}`, 54, doc.y, { width, lineGap: 2 }); }
    }
    heading('Sesiones de respaldo');
    paragraph('Los números corresponden a las notas conservadas al generar el informe. Una edición posterior de una sesión no modifica este documento.');
    doc.moveDown(.5);
    for (const source of report.sources) paragraph(`${source.number}. ${dateLabel(source.date)}`);
    if (report.status === 'reviewed' && report.reviewedAt) { doc.moveDown(.6); paragraph(`Revisión registrada: ${new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(report.reviewedAt))}`); }
    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index++) {
      doc.switchToPage(index);
      doc.save().strokeColor('#d7dfe3').lineWidth(.5).moveTo(54, 42).lineTo(doc.page.width - 54, 42).stroke().restore();
      const previousBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Body').fontSize(8).fillColor('#626f77').text(`Espacio TO | ${report.status === 'reviewed' ? 'Revisado' : 'Borrador'} | Página ${index + 1} de ${pages.count}`, 54, doc.page.height - 40, { width, lineBreak: false });
      doc.page.margins.bottom = previousBottom;
    }
    doc.end();
  });
}
