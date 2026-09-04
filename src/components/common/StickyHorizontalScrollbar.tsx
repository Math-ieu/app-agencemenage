import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StickyHorizontalScrollbarProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  tableRef?: React.RefObject<HTMLTableElement | null>;
  className?: string;
  style?: React.CSSProperties;
  dependencies?: any[];
}

export const StickyHorizontalScrollbar: React.FC<StickyHorizontalScrollbarProps> = ({
  targetRef,
  tableRef,
  className = '',
  style,
  dependencies = [],
}) => {
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingBottom = useRef(false);
  const isSyncingTable = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    if (targetRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = targetRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  }, [targetRef]);

  const handleBottomScroll = () => {
    if (isSyncingBottom.current) {
      isSyncingBottom.current = false;
      return;
    }
    if (targetRef.current && bottomScrollRef.current) {
      isSyncingTable.current = true;
      targetRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
      updateScrollState();
    }
  };

  const scrollLeftAction = () => {
    if (targetRef.current) {
      targetRef.current.scrollBy({ left: -250, behavior: 'smooth' });
    }
  };

  const scrollRightAction = () => {
    if (targetRef.current) {
      targetRef.current.scrollBy({ left: 250, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const targetEl = targetRef.current;
    if (!targetEl) return;

    const handleTargetScroll = () => {
      if (isSyncingTable.current) {
        isSyncingTable.current = false;
        return;
      }
      if (bottomScrollRef.current && targetRef.current) {
        isSyncingBottom.current = true;
        bottomScrollRef.current.scrollLeft = targetRef.current.scrollLeft;
        updateScrollState();
      }
    };

    targetEl.addEventListener('scroll', handleTargetScroll, { passive: true });

    const updateMetrics = () => {
      if (targetRef.current) {
        const sw = targetRef.current.scrollWidth;
        setTableScrollWidth(sw);
        if (bottomScrollRef.current) {
          bottomScrollRef.current.scrollLeft = targetRef.current.scrollLeft;
        }
        updateScrollState();
      }
    };

    const timer = setTimeout(updateMetrics, 60);
    updateMetrics();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateMetrics();
      });
      ro.observe(targetEl);
      if (tableRef?.current) {
        ro.observe(tableRef.current);
      } else {
        const tableChild = targetEl.querySelector('table');
        if (tableChild) {
          ro.observe(tableChild);
        }
      }
    }

    window.addEventListener('resize', updateMetrics);

    return () => {
      clearTimeout(timer);
      targetEl.removeEventListener('scroll', handleTargetScroll);
      window.removeEventListener('resize', updateMetrics);
      if (ro) ro.disconnect();
    };
  }, [targetRef, tableRef, updateScrollState, ...dependencies]);

  return (
    <div
      className={`profils-bottom-scrollbar-bar ${className}`}
      style={{
        position: 'sticky',
        bottom: '12px',
        zIndex: 25,
        backgroundColor: '#ffffff',
        padding: '8px 14px',
        marginTop: '8px',
        borderRadius: '10px',
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        ...style,
      }}
    >
      {/* Left Scroll Button */}
      <button
        type="button"
        onClick={scrollLeftAction}
        disabled={!canScrollLeft}
        title="Défiler vers la gauche"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          backgroundColor: canScrollLeft ? '#ffffff' : '#f8fafc',
          color: canScrollLeft ? '#0d9488' : '#cbd5e1',
          cursor: canScrollLeft ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <ChevronLeft size={18} />
      </button>

      {/* Bottom Scrollbar Track */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className="profils-bottom-scrollbar-track"
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          flex: 1,
          height: '14px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#0d9488 #f1f5f9',
        }}
      >
        <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
      </div>

      {/* Right Scroll Button */}
      <button
        type="button"
        onClick={scrollRightAction}
        disabled={!canScrollRight}
        title="Défiler vers la droite"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid #cbd5e1',
          backgroundColor: canScrollRight ? '#ffffff' : '#f8fafc',
          color: canScrollRight ? '#0d9488' : '#cbd5e1',
          cursor: canScrollRight ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default StickyHorizontalScrollbar;
