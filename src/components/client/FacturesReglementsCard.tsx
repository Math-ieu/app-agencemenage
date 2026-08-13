import React from 'react';
import { Receipt, Eye } from 'lucide-react';
import { Demande } from '../../types';

export interface InvoiceItem {
  id?: number | string;
  reference: string;
  periode: string;
  montant: number;
  statut: {
    type: 'envoyee' | 'payee' | 'en_attente' | 'non_payee';
    label: string;
  };
  envoyeeLe?: string;
  datePaiement?: string;
  pdfUrl?: string;
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

    const formData = latest.formulaire_data || {};
    const dbPaiement = (latest.statut_paiement || '').toLowerCase();
    const isPaid = ['integral', 'paye', 'payee'].includes(dbPaiement) || formData.statut_facturation === 'Payé';
    const items: InvoiceItem[] = [];

    // 1. Check for explicitly validated invoices in formulaire_data.factures_validees
    const facturesValidees = Array.isArray(formData.factures_validees) ? formData.factures_validees : [];
    if (facturesValidees.length > 0) {
      facturesValidees.forEach((fv: any, idx: number) => {
        const mVal = Number(fv.montant) || Number(fv.montant_ttc) || Number(fv.montant_ht) || 0;
        if (mVal <= 0) return;

        const dDate = fv.date_validation ? new Date(fv.date_validation) : null;
        const dateStr = fv.date_envoi || (dDate && !isNaN(dDate.getTime())
          ? dDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          : '—');

        const isItemPaid = isPaid || fv.statut === 'payee' || fv.statut_label === 'Payée';

        items.push({
          id: fv.id || `M${fv.month_index || idx + 1}`,
          reference: fv.reference || `AM/F${String(latest.id).padStart(3, '0')}-M${fv.month_index || idx + 1}/2026`,
          periode: fv.periode || `Mois ${fv.month_index || idx + 1}`,
          montant: mVal,
          envoyeeLe: dateStr,
          statut: isItemPaid
            ? { type: 'payee', label: 'Payée' }
            : { type: 'envoyee', label: fv.statut_label || 'Envoyée' }
        });
      });

      if (items.length > 0) {
        return items;
      }
    }

    // 2. Check for real invoice documents ONLY if a valid invoice amount has been validated in the form
    const validatedMontant = Number(latest.montant_facture) || Number(formData.montant_facture) || Number(formData.total_ttc) || Number(formData.montant_ttc) || Number(formData.montant_final);

    // Si aucune facture n'a été validée dans le formulaire, ne JAMAIS afficher de montant calculé arbitraire par défaut
    if (!validatedMontant || validatedMontant <= 0) {
      return [];
    }

    const invoiceDocs = (latest.documents || []).filter(
      (doc) => doc.type_document === 'facture' || doc.nom?.toLowerCase().includes('facture')
    );

    if (invoiceDocs.length > 0) {
      // Filtrer les doublons (ex: si FACTURE_..._M1 existe, ignorer l'ancienne version non suffixée FACTURE_... du même mois)
      const hasMonthIndexedDoc = invoiceDocs.some(d => /_M\d+/i.test(d.nom || ''));
      const relevantDocs = invoiceDocs.filter(d => {
        if (hasMonthIndexedDoc && !/_M\d+/i.test(d.nom || '')) {
          return false;
        }
        return true;
      });

      const seenRefs = new Set<string>();

      relevantDocs.forEach((doc) => {
        const refName = doc.nom?.replace(/\.pdf$/i, '') || `AM/F${String(latest.id).padStart(3, '0')}/2026`;
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
          id: doc.id,
          reference: refName,
          periode: capitalizedMonth,
          montant: validatedMontant,
          envoyeeLe: dateStr,
          statut: isPaid
            ? { type: 'payee', label: 'Payée' }
            : { type: 'envoyee', label: 'Envoyée' }
        });
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
                  Aucune facture validée pour le moment.
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
