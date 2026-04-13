import { useEffect, useState } from 'react';
import { Calendar, Check, ChevronDown, Download, FileText, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import { createCaisseMouvement, exportCaisseCsv, getCaisse, getCaisseSolde, updateCaisseMouvement } from '../../api/client';
import './LaCaisse.css';

interface CashRow {
  id: number;
  date: string;
  type: 'Entrée' | 'Sortie';
  typeCode: 'entree' | 'sortie';
  libelle: string;
  client: string;
  modePaiement: string;
  modePaiementCode: 'especes' | 'virement' | 'cheque' | 'paiement_agence';
  montant: string;
  montantNumber: number;
  utilisateur: string;
  document: string;
}

const paymentModes = ['Espèces', 'Virement', 'Chèque', 'Paiement agence'];
const operationTypes = ['Entrée', 'Sortie'];

const todayInputDate = (): string => new Date().toISOString().slice(0, 10);
const moneyFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const paymentCodeToLabel = (value: string): 'Espèces' | 'Virement' | 'Chèque' | 'Paiement agence' => {
  if (value === 'virement') return 'Virement';
  if (value === 'cheque') return 'Chèque';
  if (value === 'paiement_agence') return 'Paiement agence';
  return 'Espèces';
};

const paymentLabelToCode = (value: string): 'especes' | 'virement' | 'cheque' | 'paiement_agence' => {
  if (value === 'Virement') return 'virement';
  if (value === 'Chèque') return 'cheque';
  if (value === 'Paiement agence') return 'paiement_agence';
  return 'especes';
};

const typeCodeToLabel = (value: string): 'Entrée' | 'Sortie' => (value === 'sortie' ? 'Sortie' : 'Entrée');
const typeLabelToCode = (value: string): 'entree' | 'sortie' => (value === 'Sortie' ? 'sortie' : 'entree');

const toDisplayDate = (value: string): string => {
  if (!value) return '—';
  if (value.includes('/')) return value;
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const toInputDate = (value: string): string => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
};

const extractAmount = (value: string): string => {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return '0.00';
  return parsed.toString();
};

export default function LaCaisse() {
  const [rows, setRows] = useState<CashRow[]>([]);
  const [operationsCount, setOperationsCount] = useState(0);
  const [stats, setStats] = useState({ total_entrees: 0, total_sorties: 0, solde: 0, solde_jour: 0 });
  const [loadingRows, setLoadingRows] = useState(true);

  const [typeFilter, setTypeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [savingMovement, setSavingMovement] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [selectedOperationType, setSelectedOperationType] = useState('Entrée');
  const [isOperationMenuOpen, setIsOperationMenuOpen] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('Espèces');
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [movementDate, setMovementDate] = useState(todayInputDate());
  const [movementAmount, setMovementAmount] = useState('0.00');
  const [movementLabel, setMovementLabel] = useState('');
  const [movementClient, setMovementClient] = useState('');
  const [movementUser, setMovementUser] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [movementDocumentName, setMovementDocumentName] = useState('Cliquer pour télécharger (facture, reçu...)');
  const [movementDocumentFile, setMovementDocumentFile] = useState<File | null>(null);

  const fetchStats = async () => {
    const response = await getCaisseSolde();
    setStats({
      total_entrees: Number(response.data.total_entrees || 0),
      total_sorties: Number(response.data.total_sorties || 0),
      solde: Number(response.data.solde || 0),
      solde_jour: Number(response.data.solde_jour || 0),
    });
  };

  const fetchRows = async () => {
    setLoadingRows(true);
    try {
      const params: Record<string, string> = {};
      if (typeFilter !== 'all') params.type_mouvement = typeFilter;
      if (modeFilter !== 'all') params.mode_paiement = modeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await getCaisse(params);
      const payload = response.data.results ?? response.data;
      const total = typeof response.data.count === 'number' ? response.data.count : payload.length;

      const mappedRows: CashRow[] = payload.map((item: Record<string, unknown>) => {
        const montant = Number(item.montant ?? 0);
        const typeCode = String(item.type_mouvement || 'entree') as 'entree' | 'sortie';
        const modeCode = String(item.mode_paiement || 'especes') as 'especes' | 'virement' | 'cheque' | 'paiement_agence';

        return {
          id: Number(item.id),
          date: toDisplayDate(String(item.date || '')),
          type: typeCodeToLabel(typeCode),
          typeCode,
          libelle: String(item.description || ''),
          client: String(item.client_display || item.client_nom || '—'),
          modePaiement: paymentCodeToLabel(modeCode),
          modePaiementCode: modeCode,
          montant: `${typeCode === 'entree' ? '+' : '-'}${moneyFormatter.format(Math.abs(montant))} DH`,
          montantNumber: montant,
          utilisateur: String(item.utilisateur || '—'),
          document: item.document_file ? 'Fichier' : '—',
        };
      });

      setRows(mappedRows);
      setOperationsCount(total);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [typeFilter, modeFilter, dateFrom, dateTo, searchTerm]);

  const closeMovementModal = () => {
    setShowMovementModal(false);
    setIsOperationMenuOpen(false);
    setIsPaymentMenuOpen(false);
  };

  const openAddMovementModal = () => {
    setIsEditMode(false);
    setEditingMovementId(null);
    setSelectedOperationType('Entrée');
    setSelectedPaymentMode('Espèces');
    setMovementDate(todayInputDate());
    setMovementAmount('0.00');
    setMovementLabel('');
    setMovementClient('');
    setMovementUser('');
    setMovementNotes('');
    setMovementDocumentName('Cliquer pour télécharger (facture, reçu...)');
    setMovementDocumentFile(null);
    setShowMovementModal(true);
  };

  const openEditMovementModal = (row: CashRow) => {
    setIsEditMode(true);
    setEditingMovementId(row.id);
    setSelectedOperationType(row.type);
    setSelectedPaymentMode(row.modePaiement);
    setMovementDate(toInputDate(row.date));
    setMovementAmount(extractAmount(row.montant));
    setMovementLabel(row.libelle);
    setMovementClient(row.client === '—' ? '' : row.client);
    setMovementUser(row.utilisateur === '—' ? '' : row.utilisateur);
    setMovementNotes('');
    setMovementDocumentName('Cliquer pour télécharger (facture, reçu...)');
    setMovementDocumentFile(null);
    setShowMovementModal(true);
  };

  const saveMovement = async () => {
    if (!movementLabel.trim() || !movementDate) return;

    const formData = new FormData();
    formData.append('type_mouvement', typeLabelToCode(selectedOperationType));
    formData.append('date', movementDate);
    formData.append('montant', extractAmount(movementAmount));
    formData.append('description', movementLabel.trim());
    formData.append('mode_paiement', paymentLabelToCode(selectedPaymentMode));
    formData.append('client_nom', movementClient.trim());
    formData.append('utilisateur', movementUser.trim());
    formData.append('notes', movementNotes.trim());
    if (movementDocumentFile) formData.append('document_file', movementDocumentFile);

    setSavingMovement(true);
    try {
      if (isEditMode && editingMovementId) {
        await updateCaisseMouvement(editingMovementId, formData);
      } else {
        await createCaisseMouvement(formData);
      }
      await Promise.all([fetchRows(), fetchStats()]);
      closeMovementModal();
    } finally {
      setSavingMovement(false);
    }
  };

  const buildFiltersParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (typeFilter !== 'all') params.type_mouvement = typeFilter;
    if (modeFilter !== 'all') params.mode_paiement = modeFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (searchTerm.trim()) params.search = searchTerm.trim();
    return params;
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const response = await exportCaisseCsv(buildFiltersParams());
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      link.href = url;
      link.download = `mouvements-caisse-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="page lc-page">
      <section className="lc-hero">
        <div className="lc-hero-title-wrap">
          <FileText size={20} />
          <div>
            <h1>Gestion de Caisse</h1>
            <p>Suivi des entrées et sorties de trésorerie</p>
          </div>
        </div>
      </section>

      <section className="lc-actions-row">
        <button type="button" className="btn btn-primary lc-add-btn" onClick={openAddMovementModal}>
          <Plus size={18} /> Ajouter un mouvement
        </button>
        <button type="button" className="btn btn-secondary lc-export-btn" onClick={handleExportCsv} disabled={exportingCsv}>
          <Download size={16} /> Export CSV
        </button>
      </section>

      <section className="lc-stats-grid">
        <article className="lc-stat-card lc-stat-teal">
          <p>SOLDE ACTUEL</p>
          <strong>{moneyFormatter.format(stats.solde)} DH</strong>
        </article>
        <article className="lc-stat-card lc-stat-green">
          <p>TOTAL ENTRÉES</p>
          <strong>{moneyFormatter.format(stats.total_entrees)} DH</strong>
        </article>
        <article className="lc-stat-card lc-stat-red">
          <p>TOTAL SORTIES</p>
          <strong>{moneyFormatter.format(stats.total_sorties)} DH</strong>
        </article>
        <article className="lc-stat-card lc-stat-amber">
          <p>SOLDE DU JOUR</p>
          <strong>{moneyFormatter.format(stats.solde_jour)} DH</strong>
          <Calendar size={16} className="lc-stat-icon" />
        </article>
      </section>

      <section className="lc-filters-row">
        <label className="lc-filter-field">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Tous les types</option>
            <option value="entree">Entrée</option>
            <option value="sortie">Sortie</option>
          </select>
        </label>

        <label className="lc-filter-field">
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">Tous les modes</option>
            <option value="especes">Espèces</option>
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
            <option value="paiement_agence">Paiement agence</option>
          </select>
        </label>

        <label className="lc-filter-field lc-date-field">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Calendar size={15} />
        </label>

        <label className="lc-filter-field lc-date-field">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Calendar size={15} />
        </label>

        <label className="lc-filter-field">
          <input
            type="text"
            placeholder="Rechercher client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </section>

      <section className="lc-table-section">
        <header className="lc-table-header">
          <h2>Mouvements de caisse</h2>
          <span>{operationsCount} opération(s)</span>
        </header>

        <div className="table-wrapper lc-table-wrap">
          <table className="data-table lc-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>TYPE</th>
                <th>LIBELLÉ</th>
                <th>CLIENT</th>
                <th>MODE PAIEMENT</th>
                <th>MONTANT</th>
                <th>UTILISATEUR</th>
                <th>DOCUMENT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td><span className="lc-type-pill">{row.type}</span></td>
                  <td className="lc-libelle">{row.libelle}</td>
                  <td>{row.client}</td>
                  <td>{row.modePaiement}</td>
                  <td className={`lc-amount ${row.typeCode === 'sortie' ? 'lc-amount-out' : ''}`}>{row.montant}</td>
                  <td>{row.utilisateur}</td>
                  <td>{row.document}</td>
                  <td>
                    <button type="button" className="icon-btn" title="Modifier" onClick={() => openEditMovementModal(row)}>
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-row">Aucun mouvement trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showMovementModal && (
        <div className="lc-modal-overlay" onClick={closeMovementModal}>
          <div className="lc-modal" onClick={(e) => e.stopPropagation()}>
            <header className="lc-modal-header">
              <h3>{isEditMode ? "Modifier l'opération" : 'Ajouter un mouvement'}</h3>
              <button type="button" className="lc-modal-close" onClick={closeMovementModal}>
                <X size={16} />
              </button>
            </header>

            <div className="lc-modal-body">
              <div className="lc-modal-grid-two">
                <div className="lc-modal-field">
                  <label>Type d'opération</label>
                  <div className="lc-modal-custom-select">
                    <button
                      type="button"
                      className="lc-modal-custom-trigger"
                      onClick={() => {
                        setIsOperationMenuOpen((prev) => !prev);
                        setIsPaymentMenuOpen(false);
                      }}
                    >
                      <span>{selectedOperationType}</span>
                      <ChevronDown size={15} />
                    </button>

                    {isOperationMenuOpen && (
                      <div className="lc-modal-custom-menu">
                        {operationTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`lc-modal-custom-item ${selectedOperationType === type ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedOperationType(type);
                              setIsOperationMenuOpen(false);
                            }}
                          >
                            <span className="lc-check-wrap">
                              {selectedOperationType === type ? <Check size={14} /> : null}
                            </span>
                            <span>{type}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lc-modal-field">
                  <label>Date</label>
                  <div className="lc-modal-input-icon">
                    <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
                    <Calendar size={15} />
                  </div>
                </div>
              </div>

              <div className="lc-modal-grid-two">
                <div className="lc-modal-field">
                  <label>Montant (MAD) *</label>
                  <input type="text" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
                </div>

                <div className="lc-modal-field">
                  <label>Mode de paiement</label>
                  <div className="lc-modal-custom-select">
                    <button
                      type="button"
                      className="lc-modal-custom-trigger"
                      onClick={() => {
                        setIsPaymentMenuOpen((prev) => !prev);
                        setIsOperationMenuOpen(false);
                      }}
                    >
                      <span>{selectedPaymentMode}</span>
                      <ChevronDown size={15} />
                    </button>

                    {isPaymentMenuOpen && (
                      <div className="lc-modal-custom-menu">
                        {paymentModes.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`lc-modal-custom-item ${selectedPaymentMode === mode ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedPaymentMode(mode);
                              setIsPaymentMenuOpen(false);
                            }}
                          >
                            <span className="lc-check-wrap">
                              {selectedPaymentMode === mode ? <Check size={14} /> : null}
                            </span>
                            <span>{mode}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lc-modal-field">
                <label>Libellé / Motif *</label>
                <textarea
                  rows={3}
                  placeholder="Décrivez le motif de l'opération..."
                  value={movementLabel}
                  onChange={(e) => setMovementLabel(e.target.value)}
                />
              </div>

              <div className="lc-modal-field">
                <label>Client associé (optionnel)</label>
                <div className="lc-modal-search-wrap">
                  <input
                    type="text"
                    placeholder="Nom du client"
                    value={movementClient}
                    onChange={(e) => setMovementClient(e.target.value)}
                  />
                  <button type="button" className="lc-modal-search-btn" title="Rechercher">
                    <Search size={16} />
                  </button>
                </div>
              </div>

              <div className="lc-modal-field">
                <label>Utilisateur</label>
                <input type="text" value={movementUser} onChange={(e) => setMovementUser(e.target.value)} />
              </div>

              <div className="lc-modal-field">
                <label>Document justificatif (optionnel)</label>
                <label className="lc-upload-box">
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setMovementDocumentFile(file);
                      setMovementDocumentName(file?.name ?? 'Cliquer pour télécharger (facture, reçu...)');
                    }}
                  />
                  <Upload size={16} />
                  <span>{movementDocumentName}</span>
                </label>
              </div>

              <div className="lc-modal-field">
                <label>Notes (optionnel)</label>
                <textarea rows={3} placeholder="Remarques..." value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} />
              </div>
            </div>

            <footer className="lc-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeMovementModal} disabled={savingMovement}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={saveMovement} disabled={savingMovement}>
                {isEditMode ? 'Modifier' : 'Enregistrer'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
