import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { normalizeEmploymentLevel } from '../../constants/profile';
import type { MessageCheckboxOption } from '../../utils/sessionSettings';
import {
  buildMessageDemandesSummary,
  buildMessageSurLesLieuxSummary,
  formatExecutionValue,
  formatIdeeManoeuvreList,
  formatSoiecList,
  getSimpleSectionContentList,
  getSimpleSectionText
} from '../../utils/soiec';
import {
  fetchInterventionDetails,
  fetchUserInterventionHistory,
  type InterventionHistoryDetails,
  type MessageHistoryEntry
} from '../../services/historyService';
import {
  deleteIntervention,
  type InterventionHistoryItem
} from '../../services/interventionsService';

type InterventionHistorySectionProps = {
  defaultCommandLevel: string | null | undefined;
  isOpen: boolean;
  messageDemandeOptions: MessageCheckboxOption[];
  messageSurLesLieuxOptions: MessageCheckboxOption[];
  onToggle: () => void;
  userId: string | null | undefined;
};

const formatInterventionDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatHistoryTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const buildAddressLine = (item: InterventionHistoryItem) => (
  item.address_line1?.trim()
  || [item.street_number, item.street_name].filter(Boolean).join(' ').trim()
);

const buildCityLine = (item: InterventionHistoryItem) => item.city?.trim();

const canManageIntervention = (item: InterventionHistoryItem) =>
  item.role === 'owner' || item.role === 'admin';

const renderMessageSummary = (
  entry: MessageHistoryEntry,
  messageDemandeOptions: MessageCheckboxOption[],
  messageSurLesLieuxOptions: MessageCheckboxOption[]
) => {
  const demandesSummary = buildMessageDemandesSummary(entry.payload.demandes, messageDemandeOptions);
  const surLesLieuxSummary = buildMessageSurLesLieuxSummary(entry.payload.surLesLieux, messageSurLesLieuxOptions);
  return (
    <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">
        {entry.type === 'MESSAGE_AMBIANCE_VALIDATED' ? 'Message ambiance' : 'Message compte rendu'} • {formatHistoryTimestamp(entry.createdAt)}
      </div>
      <div className="text-xs text-slate-500 dark:text-gray-400">
        {entry.payload.date || entry.payload.time ? `${entry.payload.date || ''} ${entry.payload.time || ''}`.trim() : 'Horodatage non renseigné'}
      </div>
      <div className="mt-2 grid gap-2 text-xs text-slate-700 dark:text-gray-200">
        {entry.payload.jeSuis && <div>Je suis: {entry.payload.jeSuis}</div>}
        {entry.payload.jeVois && <div>Je vois: {entry.payload.jeVois}</div>}
        {entry.payload.jeDemande && <div>Je demande: {entry.payload.jeDemande}</div>}
        {entry.payload.jePrevois && <div>Je prévois: {entry.payload.jePrevois}</div>}
        {entry.payload.jeFais && <div>Je fais: {entry.payload.jeFais}</div>}
        {demandesSummary.length > 0 && <div>Demandes: {demandesSummary.join(', ')}</div>}
        {surLesLieuxSummary.length > 0 && <div>Sur les lieux: {surLesLieuxSummary.join(', ')}</div>}
      </div>
    </div>
  );
};

const InterventionHistorySection = ({
  defaultCommandLevel,
  isOpen,
  messageDemandeOptions,
  messageSurLesLieuxOptions,
  onToggle,
  userId
}: InterventionHistorySectionProps) => {
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<InterventionHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySelectedId, setHistorySelectedId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<InterventionHistoryDetails | null>(null);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [historyDetailStatus, setHistoryDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);
  const [historyDeleteId, setHistoryDeleteId] = useState<string | null>(null);
  const [historyDeleteError, setHistoryDeleteError] = useState<string | null>(null);

  const getHistoryType = useCallback((item: InterventionHistoryItem) => (
    normalizeEmploymentLevel(item.command_level) || normalizeEmploymentLevel(defaultCommandLevel) || 'group'
  ), [defaultCommandLevel]);

  const openHistoryIntervention = useCallback((item: InterventionHistoryItem) => {
    const targetType = getHistoryType(item);
    const startedAtMs = item.created_at ? new Date(item.created_at).getTime() : Date.now();
    navigate(`/situation/${targetType}/dictate`, {
      state: { mode: 'resume', interventionId: item.id, startedAtMs }
    });
  }, [getHistoryType, navigate]);

  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setHistoryStatus('error');
      setHistoryError('Utilisateur non authentifié.');
      return;
    }
    setHistoryStatus('loading');
    setHistoryError(null);
    try {
      const items = await fetchUserInterventionHistory(userId);
      setHistoryItems(items);
      setHistoryStatus('ready');
    } catch (error) {
      console.error('Erreur chargement historique', error);
      setHistoryStatus('error');
      setHistoryError(error instanceof Error ? error.message : 'Impossible de charger l’historique.');
    }
  }, [userId]);

  const fetchDetails = useCallback(async (interventionId: string) => {
    setHistoryDetailStatus('loading');
    setHistoryDetailError(null);
    setHistoryDetailId(interventionId);
    try {
      const details = await fetchInterventionDetails(interventionId);
      setHistoryDetail(details);
      setHistoryDetailStatus('ready');
    } catch (error) {
      console.error('Erreur détails intervention', error);
      setHistoryDetailStatus('error');
      setHistoryDetailError(error instanceof Error ? error.message : 'Impossible de charger le détail.');
    }
  }, []);

  const handleToggleHistoryItem = useCallback((interventionId: string) => {
    if (historySelectedId === interventionId) {
      setHistorySelectedId(null);
      setHistoryDetail(null);
      setHistoryDetailId(null);
      setHistoryDetailStatus('idle');
      setHistoryDetailError(null);
      setHistoryDeleteError(null);
      return;
    }
    setHistorySelectedId(interventionId);
    setHistoryDetail(null);
    setHistoryDetailError(null);
    setHistoryDeleteError(null);
    void fetchDetails(interventionId);
  }, [fetchDetails, historySelectedId]);

  const handleDeleteIntervention = useCallback(async (item: InterventionHistoryItem) => {
    if (!canManageIntervention(item)) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Supprimer définitivement cette intervention ?');
      if (!confirmed) return;
    }
    setHistoryDeleteId(item.id);
    setHistoryDeleteError(null);
    try {
      await deleteIntervention(item.id);
      if (historySelectedId === item.id) {
        setHistorySelectedId(null);
        setHistoryDetail(null);
        setHistoryDetailId(null);
        setHistoryDetailStatus('idle');
        setHistoryDetailError(null);
      }
      await fetchHistory();
    } catch (error) {
      console.error('Erreur suppression intervention', error);
      setHistoryDeleteError(error instanceof Error ? error.message : 'Impossible de supprimer l’intervention.');
    } finally {
      setHistoryDeleteId(null);
    }
  }, [fetchHistory, historySelectedId]);

  useEffect(() => {
    if (isOpen && historyStatus === 'idle') {
      void fetchHistory();
    }
  }, [fetchHistory, historyStatus, isOpen]);

  return (
    <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-200/60 dark:bg-amber-500/20 rounded-lg">
            <History className="w-5 h-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <div className="font-medium text-lg">Historique des interventions</div>
            <div className="text-xs text-slate-500 dark:text-gray-400">
              Retrouvez les interventions clôturées et les détails associés.
            </div>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-gray-400">
            <div>Chargement auto à l’ouverture.</div>
            <button
              onClick={() => void fetchHistory()}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10 transition"
            >
              Rafraîchir
            </button>
          </div>

          {historyStatus === 'loading' && (
            <div className="text-sm text-slate-500 dark:text-gray-400">Chargement de l’historique…</div>
          )}
          {historyStatus === 'error' && historyError && (
            <div className="text-sm text-red-600 dark:text-red-300">{historyError}</div>
          )}
          {historyStatus === 'ready' && historyItems.length === 0 && (
            <div className="text-sm text-slate-500 dark:text-gray-400">Aucune intervention disponible.</div>
          )}
          {historyStatus === 'ready' && historyItems.length > 0 && (
            <div className="space-y-3">
              {historyItems.map((item) => {
                const addressLine = buildAddressLine(item);
                const cityLine = buildCityLine(item);
                const dateLabel = formatInterventionDate(item.updated_at || item.created_at);
                const isClosed = item.status === 'closed';
                const isDetailReady = historyDetailStatus === 'ready' && historyDetailId === item.id && historyDetail;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.incident_number ? `Intervention ${item.incident_number}` : item.title || `Intervention ${item.id.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          {[addressLine, cityLine].filter(Boolean).join(' • ') || 'Adresse non renseignée'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-gray-400">
                          {dateLabel ? `Mis à jour ${dateLabel}` : 'Date inconnue'} • {isClosed ? 'Clôturée' : 'En cours'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleHistoryItem(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-neutral transition"
                      >
                        {historySelectedId === item.id ? 'Masquer le détail' : 'Voir le détail'}
                      </button>
                    </div>

                    {historySelectedId === item.id && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
                        {historyDetailStatus === 'loading' && (
                          <div className="text-sm text-slate-500 dark:text-gray-400">Chargement du détail…</div>
                        )}
                        {historyDetailStatus === 'error' && historyDetailError && (
                          <div className="text-sm text-red-600 dark:text-red-300">{historyDetailError}</div>
                        )}
                        {isDetailReady && (
                          <div className="space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs text-slate-500 dark:text-gray-400">
                                Accès complet depuis le mode reprise.
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openHistoryIntervention(item)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-neutral transition"
                                >
                                  Ouvrir l’intervention
                                </button>
                                {canManageIntervention(item) && (
                                  <button
                                    onClick={() => void handleDeleteIntervention(item)}
                                    disabled={historyDeleteId === item.id}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-danger transition disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {historyDeleteId === item.id ? 'Suppression…' : 'Supprimer'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {historyDeleteError && historySelectedId === item.id && (
                              <div className="text-sm text-red-600 dark:text-red-300">{historyDeleteError}</div>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Moyens</div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {historyDetail.means.length} moyen{historyDetail.means.length > 1 ? 's' : ''}
                                </div>
                                {historyDetail.means.length > 0 ? (
                                  <div className="mt-2 text-xs text-slate-600 dark:text-gray-300 whitespace-pre-wrap">
                                    {historyDetail.means.map((mean) => `${mean.name} • ${mean.status === 'demande' ? 'Demandé' : 'Sur place'}`).join('\n')}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Aucun moyen enregistré.</div>
                                )}
                              </div>
                              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-3 space-y-1">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">SITAC</div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {historyDetail.sitacCount} élément{historyDetail.sitacCount > 1 ? 's' : ''}
                                </div>
                                {historyDetail.octCounts && (
                                  <div className="text-xs text-slate-600 dark:text-gray-300">
                                    OCT: {historyDetail.octCounts.total} noeud{historyDetail.octCounts.total > 1 ? 's' : ''} • {historyDetail.octCounts.sectors} secteur{historyDetail.octCounts.sectors > 1 ? 's' : ''} • {historyDetail.octCounts.engines} engin{historyDetail.octCounts.engines > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Messages</h4>
                              {historyDetail.messages.length ? (
                                <div className="space-y-3">
                                  {historyDetail.messages.map((entry) => renderMessageSummary(entry, messageDemandeOptions, messageSurLesLieuxOptions))}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-gray-400">Aucun message validé.</div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">SITAC</h4>
                              {historyDetail.sitacFeatures.length ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {historyDetail.sitacFeatures.slice(0, 20).map((feature) => (
                                    <div
                                      key={feature.id}
                                      className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-2 py-1.5"
                                    >
                                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: feature.color }} />
                                      <div className="text-xs text-slate-700 dark:text-gray-200">
                                        <span className="font-semibold">{feature.label}</span>
                                        <span className="text-slate-500 dark:text-gray-400"> • {feature.symbolType}</span>
                                      </div>
                                    </div>
                                  ))}
                                  {historyDetail.sitacFeatures.length > 20 && (
                                    <div className="text-xs text-slate-500 dark:text-gray-400">
                                      +{historyDetail.sitacFeatures.length - 20} autres éléments
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-gray-400">Aucun élément SITAC.</div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ordre initial</h4>
                              {historyDetail.ordreInitialHistory.length ? (
                                <div className="space-y-3">
                                  {historyDetail.ordreInitialHistory.map((entry) => (
                                    <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Validé le {formatHistoryTimestamp(entry.createdAt)}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-gray-400">
                                        {entry.payload.soiecType ? `${entry.payload.soiecType} • ` : ''}Risques: {entry.payload.selectedRisks?.length ?? 0}
                                      </div>
                                      <div className="mt-3 grid gap-3 text-xs">
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Situation</div>
                                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                                            {getSimpleSectionText(entry.payload.ordreData?.S) || '-'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Objectifs</div>
                                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatSoiecList(entry.payload.ordreData?.O)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Idée de manœuvre</div>
                                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatIdeeManoeuvreList(entry.payload.ordreData?.I || [])}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Exécution</div>
                                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatExecutionValue(entry.payload.ordreData?.E)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Commandement</div>
                                          <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                                            {getSimpleSectionText(entry.payload.ordreData?.C) || '-'}
                                          </div>
                                        </div>
                                        {getSimpleSectionContentList(entry.payload.ordreData?.A).length > 0 && (
                                          <div>
                                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Anticipation</div>
                                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatSoiecList(entry.payload.ordreData?.A)}</div>
                                          </div>
                                        )}
                                        {getSimpleSectionContentList(entry.payload.ordreData?.L).length > 0 && (
                                          <div>
                                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Logistique</div>
                                            <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatSoiecList(entry.payload.ordreData?.L)}</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-gray-400">Aucun ordre initial validé.</div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ordre de conduite</h4>
                              {historyDetail.ordreConduiteHistory.length ? (
                                <div className="space-y-2">
                                  {historyDetail.ordreConduiteHistory.map((entry) => (
                                    <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Validé le {formatHistoryTimestamp(entry.createdAt)}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-gray-400">
                                        Risques: {entry.payload.conduiteSelectedRisks?.length ?? 0}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 dark:text-gray-400">Aucun ordre de conduite validé.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InterventionHistorySection;
