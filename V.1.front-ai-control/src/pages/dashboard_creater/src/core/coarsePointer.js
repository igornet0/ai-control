import { useEffect, useState } from 'react';

export const COARSE_POINTER_MQ = '(pointer: coarse)';

/**
 * @returns {boolean}
 */
export function isCoarsePointer() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    try {
        return window.matchMedia(COARSE_POINTER_MQ).matches;
    } catch {
        return false;
    }
}

/**
 * Live (pointer: coarse) for layout/behavior that should follow the device, not viewport width.
 * @returns {boolean}
 */
export function useCoarsePointer() {
    const [coarse, setCoarse] = useState(() => isCoarsePointer());

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }
        const mq = window.matchMedia(COARSE_POINTER_MQ);
        const onChange = (e) => setCoarse(Boolean(e.matches));
        setCoarse(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return coarse;
}
