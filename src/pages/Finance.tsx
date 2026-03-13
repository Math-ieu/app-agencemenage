import { useEffect, useState } from 'react';
import { getFactures, getCaisseSolde } from '../api/client';
import { Search, Download, Plus, Wallet, FileText, ArrowRightLeft } from 'lucide-react';

interface Facture {
  id: number;
  numero: string;
  client: number;
  montant_total: string;
  montant_paye: string;
  reste_a_payer: string;
  statut: string;
  date_emission: string;
}

export default function Finance() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [solde, setSolde] = useState({ total_entrees: 0, total_sorties: 0, solde: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [facturesRes, soldeRes] = await Promise.all([
          getFactures(),
          getCaisseSolde()
        ]);
        setFactures(facturesRes.data.results || facturesRes.data);
        setSolde(soldeRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion Financière</h1>
          <p className="page-subtitle">Suivez la facturation et la trésorerie de l'agence</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary">
            <Download size={16} /> Exporter Rapport
          </button>
          <button className="btn btn-primary">
            <Plus size={16} /> Nouvelle Facture
          </button>
        </div>
      </div>

      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="stat-icon stat-icon-gold"><Wallet size={22} /></div>
          <div>
            <p className="stat-label">Solde Caisse</p>
            <p className="stat-value">{solde.solde} MAD</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><ArrowRightLeft size={22} className="rotate-90" /></div>
          <div>
            <p className="stat-label">Total Entrées</p>
            <p className="stat-value">{solde.total_entrees} MAD</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><FileText size={22} /></div>
          <div>
            <p className="stat-label">Factures générées</p>
            <p className="stat-value">{factures.length}</p>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className="tab tab-active">Factures</button>
        <button className="tab">Mouvements de Caisse</button>
        <button className="tab">Historique des Paiements</button>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="N° de facture, nom du client..." className="search-input" />
        </div>
        <select className="filter-select">
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="partiel">Paiement partiel</option>
          <option value="paye">Payée</option>
          <option value="annule">Annulée</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Date d'émission</th>
                <th>Montant Total</th>
                <th>Montant Payé</th>
                <th>Reste à Payer</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id}>
                  <td className="font-mono fw-medium">{f.numero}</td>
                  <td>{new Date(f.date_emission).toLocaleDateString('fr-FR')}</td>
                  <td className="fw-medium">{f.montant_total} MAD</td>
                  <td className="text-green">{f.montant_paye} MAD</td>
                  <td className="text-red">{f.reste_a_payer} MAD</td>
                  <td>
                    <span className={`badge ${
                      f.statut === 'paye' ? 'badge-green' :
                      f.statut === 'en_attente' ? 'badge-orange' :
                      f.statut === 'partiel' ? 'badge-blue' : 'badge-gray'
                    }`}>
                      {f.statut.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="btn btn-primary btn-sm">Saisir Paiement</button>
                  </td>
                </tr>
              ))}
              {factures.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">Aucune facture trouvée.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
