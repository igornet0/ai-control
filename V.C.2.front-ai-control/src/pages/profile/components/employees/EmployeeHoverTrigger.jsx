import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { employeeService } from '../../../../services/employeeService';
import EmployeeHoverCard from './EmployeeHoverCard';

export default function EmployeeHoverTrigger({
  employee,
  children,
  className = '',
  clickToPin = false,
  profileSource = 'org',
}) {
  const [hoverVisible, setHoverVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const fetchAbortRef = useRef(false);
  const visible = hoverVisible || pinned;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardWidth = 288;
    const margin = 8;
    let left = rect.left;
    let top = rect.bottom + margin;

    if (left + cardWidth > window.innerWidth - margin) {
      left = window.innerWidth - cardWidth - margin;
    }
    if (left < margin) left = margin;

    const cardHeightEstimate = 220;
    if (top + cardHeightEstimate > window.innerHeight - margin) {
      top = rect.top - cardHeightEstimate - margin;
      if (top < margin) top = margin;
    }

    setPosition({ top, left });
  }, []);

  const loadDetail = useCallback(async () => {
    if (!employee?.id || detail?.id === employee.id) return;
    setLoading(true);
    fetchAbortRef.current = false;
    try {
      const fetchProfile =
        profileSource === 'chat'
          ? employeeService.getChatEmployee.bind(employeeService)
          : employeeService.getEmployee.bind(employeeService);
      const data = await fetchProfile(employee.id);
      if (!fetchAbortRef.current) {
        setDetail(data);
      }
    } catch {
      if (!fetchAbortRef.current) {
        setDetail(employee);
      }
    } finally {
      if (!fetchAbortRef.current) {
        setLoading(false);
      }
    }
  }, [employee, detail?.id, profileSource]);

  const show = () => {
    clearTimeout(hideTimeoutRef.current);
    setHoverVisible(true);
    updatePosition();
    loadDetail();
  };

  const scheduleHide = () => {
    if (pinned) return;
    hideTimeoutRef.current = setTimeout(() => setHoverVisible(false), 120);
  };

  const cancelHide = () => {
    clearTimeout(hideTimeoutRef.current);
  };

  const handleClick = (event) => {
    if (!clickToPin) return;
    event.stopPropagation();
    event.preventDefault();
    const nextPinned = !pinned;
    setPinned(nextPinned);
    setHoverVisible(nextPinned);
    if (nextPinned) {
      updatePosition();
      loadDetail();
    }
  };

  useEffect(() => {
    if (!visible) return undefined;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [visible, updatePosition]);

  useEffect(() => {
    if (!pinned) return undefined;
    const onDocPointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        cardRef.current?.contains(event.target)
      ) {
        return;
      }
      setPinned(false);
      setHoverVisible(false);
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [pinned]);

  useEffect(() => () => {
    clearTimeout(hideTimeoutRef.current);
    fetchAbortRef.current = true;
  }, []);

  if (!employee?.id) {
    return <div className={className}>{children}</div>;
  }

  const cardEmployee = detail || employee;

  return (
    <>
      <div
        ref={triggerRef}
        className={`${clickToPin ? 'cursor-pointer' : 'cursor-default'} ${className}`}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (clickToPin && (event.key === 'Enter' || event.key === ' ')) {
            handleClick(event);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`Карточка сотрудника ${employee.name || ''}`.trim()}
        aria-expanded={visible}
      >
        {children}
      </div>

      {visible && createPortal(
        <div
          ref={cardRef}
          className="fixed z-[9999]"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <EmployeeHoverCard employee={cardEmployee} loading={loading && !detail} />
        </div>,
        document.body
      )}
    </>
  );
}
