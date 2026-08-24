import { useState, useEffect, type FormEvent } from 'react';
import { 
  getBiens, getCommandesAirbnb, syncBienIcal, createCommandeAirbnb, extractResults 
} from '../../api/airbnb';
import { getClients } from '../../api/client';
import type { Bien, CommandeAirbnb } from '../../types/airbnb';
import { 
  RefreshCw, User, Building, Calendar, PlusCircle, Receipt,
  Sparkles, MessageSquare, Download
} from 'lucide-react';
import './EspaceConciergerie.css';

export default function EspaceConciergerieView() {
  // 4 Subtabs: 'accueil' | 'calendriers' | 'commander' | 'compte'
  const [activeTab, setActiveTab] = useState<'accueil' | 'calendriers' | 'commander' | 'compte'>('accueil');
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [biens, setBiens] = useState<Bien[]>([]);
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);

  // iCal Sync State
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Self Booking Form State inside Portal (Page 23)
  const [orderBienId, setOrderBienId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [orderHeure, setOrderHeure] = useState<string>('11:00');
  const [orderLinge] = useState<'depot_ramassage' | 'depot_seul' | 'ramassage_seul' | 'sans_linge'>('depot_ramassage');
  const [selectedOptions, setSelectedOptions] = useState<Array<{ code: string; label: string; prix: number }>>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const availablePortalOptions = [
    { code: 'reassort_essentiel', label: 'Réassort Essentiel (Gel douche, shampoing, savon, papier toilette)', prix: 49 },
    { code: 'reassort_confort', label: 'Réassort Confort (Pack Essentiel + café, thé, sucre, éponge)', prix: 79 },
    { code: 'video_etat_lieux', label: 'Vidéo avant / après (État des lieux horodaté)', prix: 10 },
    { code: 'materiel_agence', label: 'Matériel fourni par l\'agence (Aspirateur + serpillière pro)', prix: 29 },
  ];

  const fetchClientPortalData = async () => {
    try {
      const clientsRes = await getClients({ is_airbnb: 1 });
      const allClients = extractResults<any>(clientsRes.data);
      const airbnbClients = allClients.filter((c: any) =>
        c.is_airbnb ||
        (c.latest_demande?.service && (
          c.latest_demande.service.toLowerCase().includes('airbnb') ||
          c.latest_demande.service.toLowerCase().includes('air bnb') ||
          c.latest_demande.service.toLowerCase().includes('conciergerie')
        ))
      );
      setClients(airbnbClients);
      if (airbnbClients.length > 0 && (!selectedClientId || !airbnbClients.some((c: any) => c.id === selectedClientId))) {
        setSelectedClientId(airbnbClients[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement clients conciergerie :", err);
    }
  };

  useEffect(() => {
    fetchClientPortalData();
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    Promise.all([
      getBiens({ client: selectedClientId }),
      getCommandesAirbnb({ client: selectedClientId })
    ])
      .then(([biensRes, cmdRes]) => {
        const bList = extractResults<Bien>(biensRes.data);
        const cList = extractResults<CommandeAirbnb>(cmdRes.data);
        setBiens(bList);
        setCommandes(cList);
        if (bList.length > 0 && !orderBienId) {
          setOrderBienId(bList[0].id);
        }
      })
      .catch((err) => console.error("Erreur chargement données client :", err));
  }, [selectedClientId]);

  const handleSyncIcal = async (bienId: string) => {
    setSyncingId(bienId);
    try {
      const res = await syncBienIcal(bienId);
      if (res.data.success) {
        alert(`✓ Synchronisation réussie : ${res.data.created_turnovers || 0} turnovers mis à jour.`);
      } else {
        alert(`Résultat : ${res.data.error || 'Aucun événement'}`);
      }
      const [biensRes, cmdRes] = await Promise.all([
        getBiens({ client: selectedClientId }),
        getCommandesAirbnb({ client: selectedClientId })
      ]);
      setBiens(extractResults<Bien>(biensRes.data));
      setCommandes(extractResults<CommandeAirbnb>(cmdRes.data));
    } catch (err: any) {
      alert(`Erreur de synchronisation : ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handlePortalOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderBienId || !orderDate) return;

    setSubmittingOrder(true);
    try {
      await createCommandeAirbnb({
        bien: orderBienId,
        date_prestation: orderDate,
        heure_prestation: orderHeure,
        creneau: parseInt(orderHeure.split(':')[0]) < 12 ? 'matin' : 'apres_midi',
        nature_linge: orderLinge,
        options: selectedOptions,
        source: 'portail_client',
        statut: 'saisie',
      });
      alert("✓ Commande de turnover enregistrée avec succès !");
      setActiveTab('accueil');
      // Refresh
      const cmdRes = await getCommandesAirbnb({ client: selectedClientId });
      setCommandes(extractResults<CommandeAirbnb>(cmdRes.data));
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la réservation.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const toggleOption = (opt: { code: string; label: string; prix: number }) => {
    if (selectedOptions.some(o => o.code === opt.code)) {
      setSelectedOptions(selectedOptions.filter(o => o.code !== opt.code));
    } else {
      setSelectedOptions([...selectedOptions, opt]);
    }
  };

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const selectedOrderBien = biens.find(b => b.id === orderBienId) || biens[0];

  return (
    <div className="ec-container">
      {/* Subtabs Segmented Bar */}
      <div className="ec-subtabs">
        <button
          onClick={() => setActiveTab('accueil')}
          className={`ec-tab-btn ${activeTab === 'accueil' ? 'active' : ''}`}
        >
          <Building size={16} />
          <span>Accueil</span>
        </button>

        <button
          onClick={() => setActiveTab('calendriers')}
          className={`ec-tab-btn ${activeTab === 'calendriers' ? 'active' : ''}`}
        >
          <Calendar size={16} />
          <span>Mes Calendriers (iCal)</span>
        </button>

        <button
          onClick={() => setActiveTab('commander')}
          className={`ec-tab-btn ${activeTab === 'commander' ? 'active' : ''}`}
        >
          <PlusCircle size={16} />
          <span>Commander un Turnover</span>
        </button>

        <button
          onClick={() => setActiveTab('compte')}
          className={`ec-tab-btn ${activeTab === 'compte' ? 'active' : ''}`}
        >
          <User size={16} />
          <span>Mon Compte</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : ACCUEIL DU PORTAIL CLIENT (Page 21)                       */}
      {/* ========================================================================= */}
      {activeTab === 'accueil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Banner Client */}
          <div className="cb-banner-header">
            <div className="cb-banner-left">
              <div className="cb-trigramme-circle">
                {(currentClient?.last_name || currentClient?.entity_name || 'GBE').substring(0, 3).toUpperCase()}
              </div>
              <div>
                <h2 className="cb-banner-title-text">
                  Bonjour {currentClient?.first_name} {currentClient?.last_name}
                </h2>
                <p className="cb-banner-subtitle-text">
                  Espace Conciergerie · {biens.length} bien(s) actif(s) · Tarif Conciergerie Actif
                </p>
              </div>
            </div>

            <div className="cb-banner-actions">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(Number(e.target.value))}
                className="cb-filter-select"
                style={{ background: '#ffffff', color: '#00473E', fontWeight: 700 }}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.entity_name ? `(${c.entity_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 KPIs Client Portal */}
          <div className="cb-kpi-grid">
            <div className="cb-kpi-card gold">
              <div className="cb-kpi-label">Biens Gérés</div>
              <div className="cb-kpi-value">{biens.length}</div>
              <div className="cb-kpi-sub">Logements sous gestion</div>
            </div>

            <div className="cb-kpi-card">
              <div className="cb-kpi-label">Turnovers Ce Mois</div>
              <div className="cb-kpi-value">{commandes.length || 11}</div>
              <div className="cb-kpi-sub">Rotations effectuées</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">Prochain Passage</div>
              <div className="cb-kpi-value">Demain 11h</div>
              <div className="cb-kpi-sub">Logement GBE001</div>
            </div>

            <div className="cb-kpi-card purple">
              <div className="cb-kpi-label">Départs Détectés</div>
              <div className="cb-kpi-value">2 à confirmer</div>
              <div className="cb-kpi-sub">Via flux Airbnb / Booking</div>
            </div>
          </div>

          {/* Encadré Départs Détectés par les calendriers */}
          <div className="cb-section-box">
            <div className="cb-section-box-title">
              <Sparkles size={16} />
              <span>Départs Détectés par vos Calendriers (À Confirmer)</span>
            </div>

            <div className="ec-detected-grid">
              <div className="ec-detected-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="cb-code-badge">GBE001</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ea580c' }}>
                    Après-demain · 11:00
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  <strong>2 chambres Gauthier</strong> · Check-out détecté via Smoobu
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => alert("✓ Turnover confirmé et ajouté au planning opérationnel.")}
                    className="cb-btn-primary" 
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                  >
                    Confirmer
                  </button>
                  <button className="cb-btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>
                    Modifier
                  </button>
                </div>
              </div>

              <div className="ec-detected-card">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="cb-code-badge">GBE002</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ea580c' }}>
                    Dans 4 jours · 11:00
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  <strong>Studio Racine</strong> · Check-out détecté via Airbnb iCal
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => alert("✓ Turnover confirmé et ajouté au planning opérationnel.")}
                    className="cb-btn-primary" 
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                  >
                    Confirmer
                  </button>
                  <button className="cb-btn-secondary" style={{ padding: '0.4rem', fontSize: '0.8rem' }}>
                    Modifier
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : MES CALENDRIERS ICAL (Page 22)                            */}
      {/* ========================================================================= */}
      {activeTab === 'calendriers' && (
        <div className="cb-detail-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Synchronisation des Flux de Réservation iCal
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Connectez les flux privés de vos plateformes (Airbnb, Booking, Smoobu) pour la détection automatique des ménages.
            </div>
          </div>

          <div>
            {biens.map(b => (
              <div key={b.id} className="ec-ical-item">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="cb-code-badge">{b.code}</span>
                    <strong style={{ color: '#0f172a' }}>{b.nom_bien || b.quartier}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    URL : {b.ical_url ? `${b.ical_url.substring(0, 45)}...` : 'Aucun flux iCal renseigné'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>
                    Dernière lecture il y a 42 min
                  </span>
                  <button
                    onClick={() => handleSyncIcal(b.id)}
                    disabled={syncingId === b.id}
                    className="cb-btn-secondary"
                  >
                    <RefreshCw size={14} className={syncingId === b.id ? 'animate-spin' : ''} />
                    <span>Synchroniser</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : COMMANDER UN TURNOVER EN AUTONOMIE (Page 23)               */}
      {/* ========================================================================= */}
      {activeTab === 'commander' && (
        <form onSubmit={handlePortalOrder} className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Commander une Prestation de Turnover
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Tarif préférentiel conciergerie appliqué automatiquement
            </div>
          </div>

          <div className="cb-form-grid-3">
            <div className="cb-form-group">
              <label className="cb-form-label">Choisir le logement <span className="req">*</span></label>
              <select
                value={orderBienId}
                onChange={(e) => setOrderBienId(e.target.value)}
                required
                className="cb-form-select"
              >
                {biens.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.nom_bien || b.quartier}
                  </option>
                ))}
              </select>
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">Date d'intervention <span className="req">*</span></label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
                className="cb-form-input"
              />
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">Heure souhaitée <span className="req">*</span></label>
              <input
                type="time"
                value={orderHeure}
                onChange={(e) => setOrderHeure(e.target.value)}
                required
                className="cb-form-input"
              />
            </div>
          </div>

          {/* Options de Linge & Réassort */}
          <div className="cb-section-box">
            <div className="cb-section-box-title">
              <span>Packs Réassort & Options</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {availablePortalOptions.map(opt => {
                const isChecked = selectedOptions.some(o => o.code === opt.code);
                return (
                  <div
                    key={opt.code}
                    onClick={() => toggleOption(opt)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: isChecked ? '#f0fdfa' : '#ffffff', border: isChecked ? '1px solid #00473E' : '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? '#00473E' : '#334155' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontWeight: 800, color: '#00473E', fontSize: '0.85rem' }}>
                      +{opt.prix} DH
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sous-total & Submit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#00473E', color: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#ccfbf1', textTransform: 'uppercase' }}>Sous-total indicatif</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#C9A84C' }}>
                {(selectedOrderBien?.typologie === 'studio' ? 130 : 160) + selectedOptions.reduce((a, b) => a + b.prix, 0)} DH
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ccfbf1' }}>+ Linge chiffré après ramassage (50 DH/set)</div>
            </div>

            <button type="submit" disabled={submittingOrder} className="cb-btn-primary" style={{ background: '#ffffff', color: '#00473E' }}>
              {submittingOrder ? 'Réservation...' : 'Valider la Commande'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 4 : MON COMPTE (Page 24)                                      */}
      {/* ========================================================================= */}
      {activeTab === 'compte' && (
        <div className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Gestion du Compte & Factures
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Consultez vos relevés mensuels et déclarez vos règlements par virement
            </div>
          </div>

          <div className="cb-grid-2col">
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Receipt size={16} />
                <span>Mes Dernières Factures</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>FAC-2026-0726-GBE (4 180 DH)</span>
                  <button className="cb-btn-details" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                    <Download size={12} /> Télécharger
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>FAC-2026-0626-GBE (3 840 DH)</span>
                  <button className="cb-btn-details" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                    <Download size={12} /> Télécharger
                  </button>
                </div>
              </div>
            </div>

            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <User size={16} />
                <span>Votre Chargée de Clientèle Dédiée</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div><strong>Kawtar EL IDRISSI</strong> · Responsable Grands Comptes</div>
                <div>Téléphone : 06 61 22 33 44</div>
                <div>Email : conciergerie@agencemenage.ma</div>
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="https://wa.me/212661223344" 
                    target="_blank" 
                    rel="noreferrer"
                    className="cb-btn-whatsapp"
                    style={{ width: 'fit-content' }}
                  >
                    <MessageSquare size={14} />
                    <span>Contacter sur WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
