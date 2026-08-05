import React from 'react';
import { Receipt, Eye } from 'lucide-react';
import { Demande } from '../../types';
import { getDevisBasedMonthlyAmount } from '../../utils/pricing';

export interface InvoiceItem {
  reference: string;
  periode: string;
  montant: number;
  envoyeeLe: string;
  statut: {
    type: 'envoyee' | 'payee' | 'en_attente' | 'non_payee';
    label: string;
  };
}

export interface FacturesReglementsCardProps {
  factures?: InvoiceItem[];
  latest?: Demande;
  monthPassagesPlanifies?: number;
  onGenerateInvoice?: () => void;
  onDownloadInvoice?: (reference: string) => void;
}

export const FacturesReglementsCard: React.FC<FacturesReglementsCardProps> = ({
  factures: customFactures,
  latest,
  monthPassagesPlanifies,
  onDownloadInvoice
}) => {
  // Build real invoice list from latest / DB documents
  const factures = React.useMemo<InvoiceItem[]>(() => {
    if (customFactures && customFactures.length > 0) return customFactures;
    if (!latest) return [];

    const items: InvoiceItem[] = [];

    // Priorité au montant validé dans le formulaire de facturation (total_ttc / montant_ttc / montant_facture)
    const formData = latest.formulaire_data || {};
    const validatedMontant = Number(formData.total_ttc) || Number(formData.montant_ttc) || Number(formData.montant_facture) || Number(formData.montant_final);

    const passages = monthPassagesPlanifies ?? (latest.planning?.nombre_passages_mois || formData.nombre_passages || 4);
    const realMontant = validatedMontant > 0 ? validatedMontant : getDevisBasedMonthlyAmount(latest, passages);

    const refNum = (latest as any)?.num_demande || latest.id || 118;
    const refStr = `AM/F${String(refNum).padStart(3, '0')}/2026`;

    const dbPaiement = (latest.statut_paiement || '').toLowerCase();
    const isPaid = ['integral', 'paye', 'payee'].includes(dbPaiement) || formData.statut_facturation === 'Payé';

    // 1. Check for real documents of type 'facture' attached to latest
    const invoiceDocs = (latest.documents || []).filter(
      (doc) => doc.type_document === 'facture' || doc.nom?.toLowerCase().includes('facture')
    );

    const seenRefs = new Set<string>();

    if (invoiceDocs.length > 0) {
      invoiceDocs.forEach((doc) => {
        const refName = doc.nom?.replace(/\.pdf$/i, '') || refStr;
        if (seenRefs.has(refName)) return;
        seenRefs.add(refName);

        const createdDate = doc.created_at ? new Date(doc.created_at) : new Date();
        const dateStr = !isNaN(createdDate.getTime())
          ? createdDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          : '—';
        const monthStr = !isNaN(createdDate.getTime())
          ? createdDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
          : 'Août 2026';
        const capitalizedMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

        items.push({
          reference: refName,
          periode: capitalizedMonth,
          montant: realMontant,
          envoyeeLe: dateStr,
          statut: isPaid
            ? { type: 'payee', label: 'Payée' }
            : { type: 'envoyee', label: 'Envoyée' }
        });
      });
    } else if (formData.statut_facturation || (latest as any).statut_facturation || (latest as any).statut_paiement_ui) {
      // 2. If invoice status exists in DB (facture générée / en attente / payée / non payée)
      const dateStr = latest.created_at
        ? new Date(latest.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : '15 août';

      const stLabel = formData.statut_facturation || (isPaid ? 'Payée' : 'Non payé');
      let stType: InvoiceItem['statut']['type'] = 'non_payee';
      if (isPaid) stType = 'payee';
      else if (stLabel.toLowerCase().includes('envoy')) stType = 'envoyee';
      else if (stLabel.toLowerCase().includes('attente')) stType = 'en_attente';

      items.push({
        reference: refStr,
        periode: 'Août 2026',
        montant: realMontant,
        envoyeeLe: dateStr,
        statut: { type: stType, label: stLabel }
      });
    }

    return items;
  }, [customFactures, latest, monthPassagesPlanifies]);

  return (
    <div style={{ background: 'white', border: '1px solid #d0e3e0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e6f2f0' }}>
        <Receipt size={18} color="#037265" />
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#034a3e' }}>
          Factures & règlements
        </h4>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 20px' }}>FACTURE</th>
              <th style={{ padding: '12px 20px' }}>PÉRIODE</th>
              <th style={{ padding: '12px 20px' }}>MONTANT</th>
              <th style={{ padding: '12px 20px' }}>ENVOYÉE LE</th>
              <th style={{ padding: '12px 20px' }}>STATUT</th>
              <th style={{ padding: '12px 20px', textAlign: 'right' }}>APERÇU</th>
            </tr>
          </thead>
          <tbody>
            {factures.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px 20px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Aucune facture générée pour le moment.
                </td>
              </tr>
            ) : (
              factures.map((item, idx) => {
                const isPayee = item.statut.type === 'payee';
                const isEnvoyee = item.statut.type === 'envoyee';

                let badgeBg = '#f1f5f9';
                let badgeCol = '#475569';

                if (isPayee) {
                  badgeBg = '#dcfce7';
                  badgeCol = '#15803d';
                } else if (isEnvoyee) {
                  badgeBg = '#e0f2fe';
                  badgeCol = '#0369a1';
                }

                return (
                  <tr
                    key={idx}
                    onClick={() => onDownloadInvoice && onDownloadInvoice(item.reference)}
                    style={{
                      borderBottom: idx < factures.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: onDownloadInvoice ? 'pointer' : 'default',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 800, color: '#037265' }}>
                      {item.reference}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontWeight: 500 }}>
                      {item.periode}
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 800, color: '#0f172a' }}>
                      {item.montant.toLocaleString('fr-FR')} DH
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontWeight: 500 }}>
                      {item.envoyeeLe}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: badgeBg,
                          color: badgeCol
                        }}
                      >
                        {item.statut.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        type="button"
                        title="Aperçu de la facture"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDownloadInvoice) onDownloadInvoice(item.reference);
                        }}
                        style={{
                          background: '#f0fdfa',
                          border: '1px solid #ccfbf1',
                          borderRadius: 8,
                          padding: '6px 12px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: '#037265',
                          fontWeight: 700,
                          fontSize: 12
                        }}
                      >
                        <Eye size={15} color="#037265" /> Aperçu
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
