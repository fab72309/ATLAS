import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Share2, Download, Check, Copy, Bug, FileText, Send } from 'lucide-react';
import { jsPDF } from 'jspdf';
import CommandIcon from '../components/CommandIcon';
import OrdreInitialView from '../components/OrdreInitialView';
import { parseOrdreInitial } from '../utils/soiec';
import { exportOrdreToClipboard, exportOrdreToPdf, exportOrdreToShare, exportOrdreToWord, shareOrdreAsText, shareOrdreAsFile } from '../utils/export';
import { OrdreInitial } from '../types/soiec';

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { analysis, type, displaySections, fromDictation, ordre, adresse, heure_ordre } = location.state || {};
  const [copied, setCopied] = useState(false);
  const [ordreInitial, setOrdreInitial] = useState<OrdreInitial | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const sections = Array.isArray(displaySections) ? displaySections : [];
  const showDictationSections = !!fromDictation && sections.length > 0;
  const meta = { adresse, heure: heure_ordre };

  const isGroup = type === 'group';

  const stringifyAnalysis = () => {
    const text = typeof analysis === 'string'
      ? analysis
      : JSON.stringify(analysis, null, 2);
    return text || 'Aucune donnée disponible';
  };

  const handleWord = async () => {
    if (isGroup && ordreInitial) {
      await exportOrdreToWord(ordreInitial, meta);
    }
  };

  const handleShareTextChannels = (channel: 'sms' | 'whatsapp' | 'mail') => {
    if (isGroup && ordreInitial) {
      shareOrdreAsText(ordreInitial, channel, meta);
    }
  };

  const handleShareFileChannel = async (format: 'pdf' | 'word', channel: 'mail' | 'whatsapp' | 'sms') => {
    if (isGroup && ordreInitial) {
      await shareOrdreAsFile(ordreInitial, format, channel, meta);
    }
  };

  useEffect(() => {
    if (ordre) {
      setOrdreInitial(ordre);
      return;
    }
    if (isGroup && typeof analysis === 'string' && !fromDictation) {
      setOrdreInitial(parseOrdreInitial(analysis));
    }
  }, [analysis, isGroup, fromDictation, ordre]);

  const handleCopy = async () => {
    try {
      if (isGroup && ordreInitial && !showDebug) {
        await exportOrdreToClipboard(ordreInitial, meta);
      } else {
        let textToCopy = '';
        if (showDictationSections) {
          textToCopy = sections
            .map((s: any) => `${s.title}:\n${s.content}`)
            .join('\n\n') || 'Aucune donnée disponible';
        } else {
          textToCopy = stringifyAnalysis();
        }
        await navigator.clipboard.writeText(textToCopy);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    try {
      if (isGroup && ordreInitial && !showDebug) {
        await exportOrdreToShare(ordreInitial, meta);
      } else {
        const textToShare = showDictationSections
          ? sections.map((s: any) => `${s.title}:\n${s.content}`).join('\n\n')
          : stringifyAnalysis();

        if (navigator.share) {
          await navigator.share({
            title: 'Rapport A.T.L.A.S',
            text: textToShare,
          });
        } else {
          handleCopy();
        }
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleDownloadPDF = () => {
    if (isGroup && ordreInitial && !showDebug) {
      exportOrdreToPdf(ordreInitial, meta);
      return;
    }

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('fr-FR');
    const time = new Date().toLocaleTimeString('fr-FR');

    doc.setFontSize(20);
    doc.text('Rapport A.T.L.A.S', 20, 20);

    doc.setFontSize(12);
    doc.text(`Généré le ${date} à ${time}`, 20, 30);
    doc.text(`Type: ${type}`, 20, 36);

    let yPos = 50;

    if (showDictationSections) {
      sections.forEach((section: any) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 20, yPos);
        yPos += 8;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(section.content, 170);
        doc.text(splitText, 20, yPos);
        yPos += splitText.length * 7 + 10;
      });
    } else {
      const splitText = doc.splitTextToSize(stringifyAnalysis(), 170);
      doc.text(splitText, 20, yPos);
    }

    doc.save(`atlas-rapport-${Date.now()}.pdf`);
  };

  if (!location.state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-white">
        <div className="text-center animate-fade-in-down">
          <p className="text-xl text-gray-400 mb-4">Aucune donnée à afficher</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A] text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
      </div>

      <div className={`relative z-10 w-full ${isGroup ? 'max-w-[98%]' : 'max-w-4xl'} mx-auto px-4 py-6 flex flex-col items-center h-full`}>
        <div className="flex flex-col items-center mb-6 animate-fade-in-down">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-1">
            A.T.L.A.S
          </h1>
          <p className="text-gray-400 text-center text-xs md:text-sm font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full max-w-[120px] mb-6 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <CommandIcon type={type} />
        </div>

        <div className={`w-full ${isGroup ? 'max-w-full' : 'max-w-4xl'} flex justify-end gap-3 mb-4 animate-fade-in-down`} style={{ animationDelay: '0.2s' }}>
          {isGroup && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`p-2.5 border rounded-xl transition-all duration-200 ${showDebug
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-[#151515] border-white/10 text-gray-400 hover:text-white'
                }`}
              title="Mode Debug (JSON brut)"
            >
              <Bug className="w-5 h-5" />
            </button>
          )}
          {isGroup && ordreInitial && (
            <>
              <button
                onClick={() => handleShareTextChannels('sms')}
                className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
                title="Partager par SMS"
              >
                SMS
              </button>
              <button
                onClick={() => handleShareTextChannels('whatsapp')}
                className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
                title="Partager par WhatsApp"
              >
                WA
              </button>
              <button
                onClick={() => handleShareTextChannels('mail')}
                className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
                title="Partager par Mail"
              >
                <Send className="w-5 h-5" />
              </button>
              <button
                onClick={handleWord}
                className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
                title="Exporter Word"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleShareFileChannel('pdf', 'mail')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200 text-xs"
                title="Envoyer PDF (pièce jointe si supporté)"
              >
                PDF Mail
              </button>
              <button
                onClick={() => handleShareFileChannel('word', 'mail')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200 text-xs"
                title="Envoyer Word (pièce jointe si supporté)"
              >
                Word Mail
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
            title="Copier"
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </button>
          <button
            onClick={handleShare}
            className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
            title="Partager"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownloadPDF}
            className="p-2.5 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-200"
            title="Télécharger PDF"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>

        {isGroup && ordreInitial && (
          <div className="w-full max-w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 animate-fade-in-down" style={{ animationDelay: '0.22s' }}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm text-gray-300 font-semibold">Partage & Export</span>
              {adresse && <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded-full">Adresse: {adresse}</span>}
              {heure_ordre && <span className="text-xs text-gray-500 bg-white/10 px-2 py-1 rounded-full">Heure: {heure_ordre}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleShareTextChannels('sms')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-200 text-xs"
              >
                SMS (texte)
              </button>
              <button
                onClick={() => handleShareTextChannels('whatsapp')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-200 text-xs"
              >
                WhatsApp (texte)
              </button>
              <button
                onClick={() => handleShareTextChannels('mail')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-200 text-xs"
              >
                Mail (texte)
              </button>
              <button
                onClick={() => handleShareFileChannel('pdf', 'mail')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-200 text-xs"
              >
                PDF (pj si supporté)
              </button>
              <button
                onClick={() => handleShareFileChannel('word', 'mail')}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-200 text-xs"
              >
                Word (pj si supporté)
              </button>
              <button
                onClick={handleWord}
                className="px-3 py-2 bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all duration-200 text-xs"
              >
                Word (télécharger)
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Sur mobile iOS/Android récents, les pièces jointes utilisent le panneau de partage système. Sur desktop ou navigateurs limités, un téléchargement est proposé.
            </p>
          </div>
        )}

        <div className={`w-full ${isGroup ? 'max-w-full' : 'max-w-4xl'} flex-1 bg-[#151515] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl overflow-y-auto animate-fade-in-down`} style={{ animationDelay: '0.3s' }}>
          {showDictationSections ? (
            sections.length > 0 ? (
              <div className="space-y-8">
                {sections.map((section: any, index: number) => (
                  <div key={index} className="border-b border-white/5 last:border-0 pb-6 last:pb-0">
                    <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {section.title}
                    </h3>
                    <div className="text-gray-300 leading-relaxed whitespace-pre-wrap pl-3.5 border-l border-white/10">
                      {section.content || <span className="text-gray-600 italic">Non renseigné</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400">Aucune donnée à afficher.</div>
            )
          ) : (
            <>
              {isGroup && ordreInitial && !showDebug ? (
                <OrdreInitialView ordre={ordreInitial} />
              ) : (
                <div className="prose prose-invert max-w-none prose-headings:text-blue-400 prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-strong:text-white prose-code:text-blue-300 prose-code:bg-blue-900/20 prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown>{stringifyAnalysis()}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>

        <div className={`w-full ${isGroup ? 'max-w-full' : 'max-w-4xl'} mt-6 mb-[calc(env(safe-area-inset-bottom,0)+12px)] animate-fade-in-down`} style={{ animationDelay: '0.4s' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white py-4 rounded-2xl text-lg font-medium transition-all duration-200"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;
