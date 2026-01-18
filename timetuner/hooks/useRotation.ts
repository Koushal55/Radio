import { useState, useEffect, useCallback } from 'react';
import { angleToYear, snapToNearestYearAngle, yearToAngle, START_YEAR } from '../utils/yearMapper';

interface UseRotationProps {
    initialYear?: number;
    onYearChange?: (year: number) => void;
}

export const useRotation = ({ initialYear = START_YEAR, onYearChange }: UseRotationProps = {}) => {
    const [rotation, setRotation] = useState(yearToAngle(initialYear));
    const [year, setYear] = useState(initialYear);
    const [isDragging, setIsDragging] = useState(false);

    // Update year when rotation changes
    useEffect(() => {
        const newYear = angleToYear(rotation);
        if (newYear !== year) {
            setYear(newYear);
            if (onYearChange) {
                onYearChange(newYear);
            }
        }
    }, [rotation, year, onYearChange]);

    const handleDragStart = () => {
        setIsDragging(true);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        // Snap to nearest year
        const snappedRotation = snapToNearestYearAngle(rotation);
        setRotation(snappedRotation);
    };

    const handleRotate = (newRotation: number) => {
        setRotation(newRotation);
    };

    return {
        rotation,
        year,
        isDragging,
        handleDragStart,
        handleDragEnd,
        handleRotate,
        setRotation
    };
};
