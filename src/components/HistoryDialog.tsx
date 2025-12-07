import React from 'react';
import { X } from 'lucide-react';
import { HistoryEntry, getHistory } from '../utils/history';
import { useNavigate } from 'react-router-dom';

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryDialog: React.FC<HistoryDialogProps> = ({ isOpen, onClose }) => {
  const [history] = React.useState<HistoryEntry[]>(() => getHistory());
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleEntryClick = (entry: HistoryEntry) => {
    navigate('/results', { state: { analysis: entry.analysis, situation: entry.situation } });
    onClose();
  };

  const getTypeLabel = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'group':
        return 'Chef de groupe';
      case 'column':
        return 'Chef de colonne';
      case 'site':
        return 'Chef de site';
      case 'communication':
        return 'Communication OPS';
      default:
        return type;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Historique des opérations</h2>
            <p className="text-sm text-gray-500 mt-1">Consultez vos analyses précédentes</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(80vh-4rem)]">
          {history.length === 0 ? (
            <p className="p-4 text-center text-gray-500">Aucun historique disponible</p>
          ) : (
            <div className="divide-y">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => handleEntryClick(entry)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold">{getTypeLabel(entry.type)}</span>
                    <span className="text-sm text-gray-500">{entry.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{entry.situation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryDialog;
