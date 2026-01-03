import React from 'react';
import { X, Mail, MessageSquare, Share2, FileImage, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Share } from '@capacitor/share';
// Heavy libs are loaded on demand

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mapRef?: React.RefObject<HTMLDivElement>;
  address?: string;
  zones?: {
    exclusion: number;
    controlled: number;
    support: number;
  } | null;
  analysis?: string;
  displaySections?: Array<{ title: string; content: string; }>;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ 
  isOpen, 
  onClose, 
  mapRef, 
  address, 
  zones, 
  analysis,
  displaySections 
}) => {
  if (!isOpen) return null;

  const isMapShare = !!mapRef && !!address && !!zones;

  const generateFileName = () => {
    const date = format(new Date(), 'dd-MM-yy', { locale: fr });
    if (isMapShare) {
      const sanitizedAddress = address
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      return `${date}_${sanitizedAddress}`;
    }
    return `analyse_${date}`;
  };

  const captureMap = async () => {
    if (!mapRef?.current) return null;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(mapRef.current, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    });
    return canvas;
  };

  const generateAnalysisPDF = async () => {
    if (!displaySections) return;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let yPosition = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Analyse de la Situation", 20, yPosition);
    yPosition += 15;

    displaySections.forEach((section) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(section.title, 20, yPosition);
      yPosition += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      const lines = doc.splitTextToSize(section.content, 170);
      
      if (yPosition + (lines.length * 7) > 280) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text(lines, 20, yPosition);
      yPosition += (lines.length * 7) + 10;
    });

    doc.save(`${generateFileName()}.pdf`);
  };

  const handleImageExport = async () => {
    try {
      if (isMapShare) {
        const canvas = await captureMap();
        if (!canvas) return;
        
        canvas.toBlob((blob) => {
          if (!blob) return;
          const fileName = `${generateFileName()}.png`;
          const file = new File([blob], fileName, { type: 'image/png' });
          
          const link = document.createElement('a');
          link.href = URL.createObjectURL(file);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }, 'image/png');
      }
      onClose();
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Une erreur est survenue lors de l\'export de l\'image');
    }
  };

  const handlePDFExport = async () => {
    try {
      if (isMapShare) {
        const canvas = await captureMap();
        if (!canvas) return;

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        pdf.setFontSize(16);
        pdf.text('Zonage opérationnel', 14, 15);
        pdf.setFontSize(12);
        pdf.text(`Date: ${format(new Date(), 'Pp', { locale: fr })}`, 14, 25);
        pdf.text(`Adresse: ${address}`, 14, 32);

        const legendY = 45;
        pdf.setFontSize(10);
        pdf.setDrawColor(255, 24, 1);
        pdf.setFillColor(255, 24, 1);
        pdf.circle(14, legendY, 2, 'F');
        pdf.text(`Zone d'exclusion: ${zones.exclusion}m`, 20, legendY);

        pdf.setDrawColor(255, 165, 0);
        pdf.setFillColor(255, 165, 0);
        pdf.circle(14, legendY + 7, 2, 'F');
        pdf.text(`Zone contrôlée: ${zones.controlled}m`, 20, legendY + 7);

        pdf.setDrawColor(34, 197, 94);
        pdf.setFillColor(34, 197, 94);
        pdf.circle(14, legendY + 14, 2, 'F');
        pdf.text(`Zone de soutien: ${zones.support}m`, 20, legendY + 14);

        const imgWidth = pdfWidth - 28;
        const imgHeight = pdfHeight - 70;
        pdf.addImage(imgData, 'PNG', 14, 65, imgWidth, imgHeight);

        pdf.save(`${generateFileName()}.pdf`);
      } else {
        await generateAnalysisPDF();
      }
      onClose();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Une erreur est survenue lors de l\'export du PDF');
    }
  };

  const handleShare = async (method: 'email' | 'sms' | 'whatsapp') => {
    let subject, body;
    
    const currentDate = format(new Date(), 'Pp', { locale: fr });
    
    if (isMapShare) {
      subject = `Zonage opérationnel - ${currentDate}`;
      body = `Zonage opérationnel\n\nDate: ${currentDate}\nAdresse: ${address}\n\nZones:\n- Zone d'exclusion: ${zones.exclusion}m\n- Zone contrôlée: ${zones.controlled}m\n- Zone de soutien: ${zones.support}m`;
    } else {
      subject = `Analyse de situation - ${currentDate}`;
      body = analysis || displaySections?.map(s => `${s.title}:\n${s.content}`).join('\n\n') || '';
    }
    
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    
    try {
      await Share.share({ title: subject, text: body });
    } catch {
      // Fallback web
      switch (method) {
        case 'email':
          window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
          break;
        case 'sms':
          window.location.href = `sms:?body=${encodedBody}`;
          break;
        case 'whatsapp':
          window.location.href = `https://wa.me/?text=${encodedBody}`;
          break;
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {isMapShare ? 'Partager la carte' : 'Partager l\'analyse'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <button
            onClick={() => handleShare('email')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
            title="Partager par email"
          >
            <Mail className="w-6 h-6" />
            <span>Partager par email</span>
          </button>
          <button
            onClick={() => handleShare('sms')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
            title="Partager par SMS"
          >
            <MessageSquare className="w-6 h-6" />
            <span>Partager par SMS</span>
          </button>
          <button
            onClick={() => handleShare('whatsapp')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
            title="Partager via WhatsApp"
          >
            <Share2 className="w-6 h-6" />
            <span>Partager via WhatsApp</span>
          </button>
          <button
            onClick={handlePDFExport}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
            title="Exporter en PDF"
          >
            <Download className="w-6 h-6" />
            <span>Exporter en PDF</span>
          </button>
          {isMapShare && (
          <button
            onClick={handleImageExport}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100"
            title="Exporter en image"
          >
            <FileImage className="w-6 h-6" />
            <span>Exporter en image</span>
          </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
