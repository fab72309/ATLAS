import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import DictationCard from '../components/DictationCard';
import { saveCommunicationData, saveCommunicationIAData } from '../utils/firestore';
import { analyzeEmergency } from '../utils/openai';

const SECTIONS = [
  {
    id: 'engagement_secours',
    title: 'Engagement des secours',
    placeholder: 'Décrivez l\'engagement des secours...',
    fieldName: 'Engagement_secours'
  },
  {
    id: 'situation_appel',
    title: 'Situation à l\'appel',
    placeholder: 'Décrivez la situation lors de l\'appel...',
    fieldName: 'Situation_appel'
  },
  {
    id: 'situation_arrivee',
    title: 'Situation à l\'arrivée des secours',
    placeholder: 'Décrivez la situation à l\'arrivée des secours...',
    fieldName: 'Situation_arrivee'
  },
  {
    id: 'victimes',
    title: 'Nombres de victimes',
    placeholder: 'Indiquez le nombre et l\'état des victimes...',
    fieldName: 'Nombre_victimes'
  },
  {
    id: 'moyens',
    title: 'Moyens mis en œuvre',
    placeholder: 'Listez les moyens engagés...',
    fieldName: 'Moyens'
  },
  {
    id: 'actions',
    title: 'Actions des secours',
    placeholder: 'Décrivez les actions entreprises...',
    fieldName: 'Actions_secours'
  },
  {
    id: 'conseils',
    title: 'Conseils à la population',
    placeholder: 'Indiquez les conseils et consignes à la population...',
    fieldName: 'Conseils_population'
  },
];

const CommunicationOps = () => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [sections, setSections] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, '']))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [swiperInstance, setSwiperInstance] = useState<any>(null);

  const handleTextChange = (sectionId: string, text: string) => {
    setSections(prev => ({
      ...prev,
      [sectionId]: text,
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Format sections for display and analysis
      const formattedSections = SECTIONS.map(section => ({
        title: section.title,
        content: sections[section.id] || ''
      }));

      // Prepare text for analysis
      const fullSituation = formattedSections
        .map(section => `${section.title}:\n${section.content}`)
        .join('\n\n');

      // Save to Firestore
      await saveCommunicationData({
        groupe_horaire: new Date(),
        Engagement_secours: sections.engagement_secours || '',
        Situation_appel: sections.situation_appel || '',
        Situation_arrivee: sections.situation_arrivee || '',
        Nombre_victimes: sections.victimes || '',
        Moyens: sections.moyens || '',
        Actions_secours: sections.actions || '',
        Conseils_population: sections.conseils || ''
      });

      // Send to OpenAI for analysis
      const analysis = await analyzeEmergency(fullSituation, 'communication');

      // Prepare data for Communication_OPS_IA
      const iaData = {
        input: fullSituation,
        groupe_horaire: new Date(),
        Engagement_secours: sections.engagement_secours || '',
        Situation_appel: sections.situation_appel || '',
        Situation_arrivee: sections.situation_arrivee || '',
        Nombre_victimes: sections.victimes || '',
        Moyens: sections.moyens || '',
        Actions_secours: sections.actions || '',
        Conseils_population: sections.conseils || ''
      };

      // Save to Communication_OPS_IA collection
      await saveCommunicationIAData(iaData);

      // Navigate to results page
      navigate('/results', { 
        state: { 
          analysis,
          displaySections: formattedSections,
          type: 'communication',
          fromDictation: true
        }
      });
    } catch (error) {
      console.error('Error processing data:', error);
      const errorMessage = error.code === 'permission-denied' 
        ? 'Erreur de permission lors de la sauvegarde. Veuillez réessayer.'
        : 'Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const goToSlide = (index: number) => {
    if (swiperInstance) {
      swiperInstance.slideTo(index);
      setActiveIndex(index);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-3">
        <button 
          onClick={() => navigate('/')}
          className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white px-3 py-1.5 rounded-xl text-sm"
        >
          Accueil
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-4">
        <div className="flex flex-col items-center">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-0.5">
            A.T.L.A.S
          </h1>
          <p className="text-white text-center text-sm mb-4">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="w-full max-w-[200px] mb-4">
          <div className="bg-[#1A1A1A] rounded-2xl p-4 w-full max-w-[200px] mx-auto border-2 border-white">
            <div className="bg-black rounded-xl aspect-[4/3] flex flex-col justify-center items-center p-4">
              <Radio className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-lg text-white text-center mt-2">
              Communication OPS
            </h2>
          </div>
        </div>

        <div className="w-full max-w-4xl flex-1 flex flex-col relative">
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {SECTIONS.map((section, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`px-4 py-2 text-sm rounded-3xl transition-colors ${
                  index === activeIndex 
                    ? 'bg-[#FF1801] text-white' 
                    : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#2A2A2A] hover:text-white'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>

          <div className="flex-1 relative">
            <Swiper
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
              className="h-full"
              allowTouchMove={true}
              touchRatio={1}
              resistance={true}
              resistanceRatio={0.85}
              modules={[Pagination]}
              pagination={{
                clickable: true,
                bulletClass: 'swiper-pagination-bullet !bg-white !opacity-50',
                bulletActiveClass: 'swiper-pagination-bullet-active !bg-white !opacity-100',
              }}
            >
              {SECTIONS.map((section, index) => (
                <SwiperSlide key={section.id}>
                  <DictationCard
                    title={section.title}
                    value={sections[section.id]}
                    onChange={(text) => handleTextChange(section.id, text)}
                    placeholder={section.placeholder}
                    isActive={index === activeIndex}
                  />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white py-2 rounded-3xl text-base font-semibold w-full max-w-4xl mt-4 mb-4 mx-auto disabled:bg-gray-500"
          >
            {isLoading ? 'Sauvegarde en cours...' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunicationOps;