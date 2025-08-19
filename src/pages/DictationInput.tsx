import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { Swiper, SwiperSlide, useSwiper } from 'swiper/react';
import { Swiper as SwiperType } from 'swiper';
import { Pagination } from 'swiper/modules';
import { analyzeEmergency } from '../utils/openai';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { saveDictationData, saveCommunicationData } from '../utils/firestore';
import 'swiper/css';
import 'swiper/css/pagination';
import CommandIcon from '../components/CommandIcon';
import DictationCard from '../components/DictationCard';

const SECTIONS_BY_TYPE = {
  group: [
    {
      id: 'situation',
      title: 'Situation',
      placeholder: 'Décrivez la situation actuelle...',
    },
    {
      id: 'objectifs',
      title: 'Objectifs',
      placeholder: 'Définissez les objectifs...',
    },
    {
      id: 'idees',
      title: 'Idées de manœuvre',
      placeholder: 'Détaillez les idées de manœuvre...',
    },
    {
      id: 'execution',
      title: 'Exécution',
      placeholder: 'Précisez l\'exécution des actions...',
    },
    {
      id: 'commandement',
      title: 'Commandement',
      placeholder: 'Définissez la chaîne de commandement...',
    },
  ],
  site: [
    {
      id: 'situation',
      title: 'Situation',
      placeholder: 'Décrivez la situation actuelle...',
    },
    {
      id: 'objectifs',
      title: 'Objectifs',
      placeholder: 'Définissez les objectifs...',
    },
    {
      id: 'idees',
      title: 'Idées de manœuvre',
      placeholder: 'Détaillez les idées de manœuvre...',
    },
    {
      id: 'execution',
      title: 'Exécution',
      placeholder: 'Précisez l\'exécution des actions...',
    },
    {
      id: 'commandement',
      title: 'Commandement',
      placeholder: 'Définissez la chaîne de commandement...',
    },
  ],
  column: [
    {
      id: 'situation',
      title: 'Situation',
      placeholder: 'Décrivez la situation actuelle...',
    },
    {
      id: 'anticipation',
      title: 'Anticipation',
      placeholder: 'Anticipez l\'évolution possible...',
    },
    {
      id: 'objectifs',
      title: 'Objectifs',
      placeholder: 'Définissez les objectifs...',
    },
    {
      id: 'idees',
      title: 'Idées de manœuvre',
      placeholder: 'Détaillez les idées de manœuvre...',
    },
    {
      id: 'execution',
      title: 'Exécution',
      placeholder: 'Précisez l\'exécution des actions...',
    },
    {
      id: 'commandement',
      title: 'Commandement',
      placeholder: 'Définissez la chaîne de commandement...',
    },
  ],
  communication: [
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
  ]
} as const;

const getSections = (type: string) => {
  const key = type as keyof typeof SECTIONS_BY_TYPE;
  return SECTIONS_BY_TYPE[key] || SECTIONS_BY_TYPE.group;
};

const DictationInput = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { type } = useParams();
  const SECTIONS = getSections(type as string);
  const [sections, setSections] = useState<Record<string, string>>(
    Object.fromEntries(SECTIONS.map(s => [s.id, '']))
  );
  const [isLoading, setIsLoading] = useState(false);
  const swiperRef = useRef<SwiperType>();
  const navigate = useNavigate();

  const handleTextChange = (sectionId: string, text: string) => {
    setSections(prev => ({
      ...prev,
      [sectionId]: text,
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    try {
      // Vérifier si au moins une section contient du texte
      const hasContent = Object.values(sections).some(text => text.trim().length > 0);
      if (!hasContent) {
        throw new Error('Veuillez remplir au moins une section avant de générer.');
      }

      const formattedSections = SECTIONS.map(section => ({
        title: section.title,
        content: sections[section.id] || ''
      }));

      if (type === 'communication') {
        // Prepare data for Firestore
        const communicationData = {
          situation: formattedSections.map(s => `${s.title}:\n${s.content}`).join('\n\n'),
          groupe_horaire: new Date(),
          Engagement_secours: sections.engagement_secours || '',
          Situation_appel: sections.situation_appel || '',
          Situation_arrivee: sections.situation_arrivee || '',
          Nombre_victimes: sections.victimes || '',
          Moyens: sections.moyens || '',
          Actions_secours: sections.actions || '',
          Conseils_population: sections.conseils || ''
        };
        
        // Save to Firestore
        await saveCommunicationData(communicationData);
        
        // Analyze with OpenAI
        const analysis = await analyzeEmergency(communicationData.situation, 'communication');
        
        navigate('/results', { 
          state: { 
            analysis,
            type: 'communication',
            displaySections: formattedSections,
            fromDictation: true
          } 
        });
      } else {
        const dataToSave = {
          type: type as 'group' | 'column' | 'site',
          situation: sections.situation || '',
          objectifs: sections.objectifs || '',
          idees: sections.idees || '',
          execution: sections.execution || '',
          commandement: sections.commandement || '',
          ...(type === 'column' && { anticipation: sections.anticipation || '' }),
          groupe_horaire: new Date(),
        };
        await saveDictationData(dataToSave);
        
        navigate('/results', { 
          state: { 
            displaySections: formattedSections,
            type,
            fromDictation: true
          } 
        });
      }
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      alert(error.message || 'Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.');
    }
    setIsLoading(false);
  };

  const goToSlide = (index: number) => {
    if (swiperRef.current) {
      swiperRef.current.slideTo(index);
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
          <CommandIcon type={type as 'group' | 'column' | 'site' | 'communication'} />
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

          <div className="flex-1 relative min-h-[50vh]">
            <Swiper
              onBeforeInit={(swiper) => {
                swiperRef.current = swiper;
              }}
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
            className="bg-[#FF1801] hover:bg-[#D91601] transition-colors text-white py-2 rounded-3xl text-base font-semibold w-full max-w-4xl mt-4 mb-[calc(env(safe-area-inset-bottom,0)+12px)] mx-auto"
          >
            {isLoading ? 'Sauvegarde en cours...' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DictationInput;