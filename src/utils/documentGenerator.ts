import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { getJsPDF } from './jspdf';

interface Section {
  title: string;
  content: string;
}

export const generatePDF = async (sections: Section[]) => {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF();
  let yPosition = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Analyse de la Situation", 20, yPosition);
  yPosition += 15;

  sections.forEach((section) => {
    // Add section title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(section.title, 20, yPosition);
    yPosition += 10;

    // Add section content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    // Split content into lines that fit the page width
    const lines = doc.splitTextToSize(section.content, 170);
    
    // Check if we need a new page
    if (yPosition + (lines.length * 7) > 280) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.text(lines, 20, yPosition);
    yPosition += (lines.length * 7) + 10;
  });

  doc.save("analyse-situation.pdf");
};

export const generateDOCX = async (sections: Section[]) => {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Analyse de la Situation",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun("")],
          }),
          ...sections.flatMap((section) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: section.title,
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: section.content,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun("")],
            }),
          ]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "analyse-situation.docx");
};
