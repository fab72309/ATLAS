import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { History, Share2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import HistoryDialog from '../components/HistoryDialog';
import ShareDialog from '../components/ShareDialog';
import { analyzeEmergency } from '../utils/openai';
import { saveAIAnalysis, saveCommunicationIAData } from '../utils/firestore';

interface Section {
  title: string;
  content: string;
}

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { analysis, displaySections: initialSections, type, fromDictation, fromAI } = location.state || {};
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAIAnalysis = async () => {
    if (!initialSections) return;
    
    setIsAnalyzing(true);
    try {
      let situationText;
      if (type === 'communication') {
        situationText = initialSections.map(s => `${s.title}:\n${s.content}`).join('\n\n');
      } else {
        situationText = initialSections.find(s => s.title.toLowerCase() === 'situation')?.content;
      }

      if (!situationText) {
        throw new Error('No situation text found');
      }

      const analysis = await analyzeEmergency(situationText, type as 'group' | 'column' | 'communication');
      
      // Parse sections from the analysis
      let sections: Record<string, string> = {};

      if (type === 'communication') {
        // Save to Communication_OPS_IA collection
        await saveCommunicationIAData({
          input: situationText,
          groupe_horaire: new Date(),
          Engagement_secours: initialSections.find(s => s.title === 'Engagement des secours')?.content || '',
          Situation_appel: initialSections.find(s => s.title === 'Situation à l\'appel')?.content || '',
          Situation_arrivee: initialSections.find(s => s.title === 'Situation à l\'arrivée des secours')?.content || '',
          Nombre_victimes: initialSections.find(s => s.title === 'Nombres de victimes')?.content || '',
          Moyens: initialSections.find(s => s.title === 'Moyens mis en œuvre')?.content || '',
          Actions_secours: initialSections.find(s => s.title === 'Actions des secours')?.content || '',
          Conseils_population: initialSections.find(s => s.title === 'Conseils à la population')?.content || ''
        });
      } else {
        const matches = analysis.match(/\*\*(.*?):\*\*\s*([\s\S]*?)(?=\*\*|$)/g) || [];
        matches.forEach(match => {
          const [, title, content] = match.match(/\*\*(.*?):\*\*\s*([\s\S]*?)$/) || [];
          if (title && content) {
            sections[title.toLowerCase().trim()] = content.trim();
          }
        });
        
        // Save to Chef_de_groupe_IA or Chef_de_colonne_IA collection
        await saveAIAnalysis({
          input: situationText,
          output_situation: sections.situation || '',
          output_objectifs: sections.objectifs || '',
          output_idees_manoeuvre: sections['idées de manœuvre'] || '',
          output_execution: sections.exécution || '',
          output_commandement: sections.commandement || '',
          groupe_horaire: new Date()
        });
      }

      // Navigate to new results page with AI analysis
      navigate('/results', { 
        state: { 
          analysis,
          type,
          fromAI: true
        },
        replace: true
      });
    } catch (error) {
      console.error('Error:', error);
      alert(error.message || 'Une erreur est survenue lors de l\'analyse. Veuillez réessayer.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Parse sections from markdown output
  const displaySections = React.useMemo(() => {
    if (initialSections) return initialSections;
    if (!analysis) return [];
    
    if (type === 'communication') {
      return [{
        title: 'Point de Situation',
        content: analysis
      }];
    }

    // Split by section headers
    const sections = analysis.split(/^-\s*\*\*/m).filter(Boolean);
    return sections.map(section => {
      const [title, ...contentParts] = section.split(':**');
      if (!contentParts.length) return null;
      
      const content = contentParts.join(':**').trim();
      return {
        title: title.trim(),
        content: content
          .replace(/^\s*\[.*?\]\s*$/gm, '') // Remove placeholder text
          .replace(/^-\s+/gm, '• ') // Convert dashes to bullets
          .trim()
      }
    }).filter((section): section is Section => section !== null);
  }, [analysis, initialSections]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="p-4 flex justify-between items-center">
        <button 
          onClick={() => navigate('/')}
          className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-4 py-2 rounded-3xl"
        >
          Accueil
        </button>
        <button
          onClick={() => setIsShareOpen(true)}
          className="p-2 hover:bg-[#1A1A1A] rounded-full transition-colors"
        >
          <Share2 className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-24">
        <h1 className="text-xl md:text-2xl font-bold text-white mb-4 text-center">
          {type === 'communication' ? 'Point de Situation' : 'Analyse de la Situation'}
        </h1>

        <div className="grid grid-cols-1 gap-4 w-full max-w-4xl mx-auto">
          {displaySections.map((section, index) => (
            <div key={index} className="bg-white rounded-2xl p-3 shadow-lg">
              <h2 className="text-base font-bold text-gray-800 mb-1 border-b pb-1">
                {section.title.replace(/^- /, '')}
              </h2>
              <div className="prose max-w-none text-gray-700 text-xs">
                <ReactMarkdown>{section.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-[#00051E] p-4">
        <div className="w-full max-w-4xl mx-auto flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white py-2 px-4 rounded-3xl text-sm font-semibold"
          >
            Nouvelle analyse
          </button>
          {type === 'communication' && !fromAI && (
            <button
              onClick={handleAIAnalysis}
              disabled={isAnalyzing}
              className="bg-[#1A1A1A] hover:bg-[#2A2A2A] disabled:bg-gray-500 transition-colors text-white py-2 px-4 rounded-3xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {isAnalyzing ? 'Analyse en cours...' : (
                <>
                  Générer avec l'IA<Sparkles className="w-5 h-5 text-white" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      <HistoryDialog isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <ShareDialog 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        analysis={analysis || ''}
        displaySections={displaySections}
      />
    </div>
  );
};

export default Results;