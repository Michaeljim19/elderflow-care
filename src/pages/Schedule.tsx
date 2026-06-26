import React, { useState, useEffect, useMemo, useRef } from "react";
import { Calendar, Plus, Clock, Edit, Trash2, CalendarDays, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Caregiver, 
  CaregiverShift
} from "@/types";
import { getCaregivers } from "@/services/firebase/caregivers";
import { 
  getCaregiverShifts,
  updateCaregiverShift,
  deleteCaregiverShift,
  addCaregiverShift
} from "@/services/firebase/caregiverShifts";
import { Timestamp } from "firebase/firestore";

const Schedule = () => {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [shifts, setShifts] = useState<CaregiverShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<CaregiverShift | null>(null);
  const [deleteCaregiver, setDeleteCaregiver] = useState<{id: string, name: string} | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [isViewAllDialogOpen, setIsViewAllDialogOpen] = useState(false);
  const [selectedCaregiverShifts, setSelectedCaregiverShifts] = useState<{caregiverId: string, shifts: CaregiverShift[]}>({caregiverId: '', shifts: []});
  const [isAutoRotationDialogOpen, setIsAutoRotationDialogOpen] = useState(false);
  const autoRotationLockRef = useRef(false);
  const generatedPeriodKeysRef = useRef(new Set<string>());
  const [autoRotationSettings, setAutoRotationSettings] = useState({
    enabled: true,
    leadTimeHours: 4, // Hours before shift end to trigger rotation
    rotationPattern: 'round-robin' as 'round-robin' | 'random'
  });
  const [editForm, setEditForm] = useState({
    caregiverId: '',
    date: '',
    shiftType: '' as 'Day' | 'Night',
    startTime: '',
    endTime: '',
    notes: ''
  });

  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [caregiversData, shiftsData] = await Promise.all([
        getCaregivers(),
        getCaregiverShifts()
      ]);
      
      setCaregivers(caregiversData);
      setShifts(shiftsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load schedule data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Simple function to get next shift for a caregiver
  const getNextShiftForCaregiver = (caregiverId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get caregiver's future shifts sorted by date
    const futureShifts = shifts
      .filter(shift => 
        shift.caregiver_id === caregiverId && 
        shift.shift_date.toDate() > today
      )
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());
    
    if (futureShifts.length === 0) {
      return null;
    }
    
    const nextShift = futureShifts[0];
    return {
      date: nextShift.shift_date.toDate(),
      shiftType: nextShift.shift_type,
      isUpcoming: true,
      isScheduled: true
    };
  };

  // Function to get current shift for a caregiver
  const getCurrentShiftForCaregiver = (caregiverId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get caregiver's current shifts (today and ongoing)
    const currentShifts = shifts
      .filter(shift => {
        const shiftDate = shift.shift_date.toDate();
        const shiftEnd = shift.end_time instanceof Timestamp ? shift.end_time.toDate() : new Date(shift.end_time);
        return shift.caregiver_id === caregiverId && 
               shiftDate <= today && 
               shiftEnd > today;
      })
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());
    
    if (currentShifts.length === 0) {
      return null;
    }
    
    return currentShifts[0];
  };

  // Helper function to convert Timestamp to Date safely
  const timestampToDate = (timestamp: any): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else {
      return new Date(timestamp);
    }
  };

  // Function to get shift periods (group consecutive shifts of same type)
  const getShiftPeriods = (caregiverId: string) => {
    // Use all shifts for period calculation (we need to see the full timeline to determine periods)
    // but the display logic will filter what's shown
    const caregiverShifts = shifts
      .filter(shift => shift.caregiver_id === caregiverId)
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());

    if (caregiverShifts.length === 0) return { current: null, next: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date(); // Keep current time for precise period detection

    // Find current period
    let currentPeriod = null;
    let nextPeriod = null;

    // Group consecutive shifts of the same type
    const periods: Array<{
      type: 'Day' | 'Night';
      startDate: Date;
      endDate: Date;
      shifts: CaregiverShift[];
      isCurrent: boolean;
      isNext: boolean;
    }> = [];

    let currentGroup: CaregiverShift[] = [];
    let currentType: 'Day' | 'Night' | null = null;

    for (const shift of caregiverShifts) {
      const shiftStartTime = timestampToDate(shift.start_time);
      const shiftEndTime = timestampToDate(shift.end_time);

      if (shift.shift_type !== currentType) {
        // Save previous group
        if (currentGroup.length > 0 && currentType) {
          const startDate = timestampToDate(currentGroup[0].start_time);
          // Use the actual end time of the last shift in the period
          const lastShift = currentGroup[currentGroup.length - 1];
          const endTime = timestampToDate(lastShift.end_time);
          
          // For more accurate current period detection, compare with actual timestamps
          const periodStartTime = timestampToDate(currentGroup[0].start_time);
          
          periods.push({
            type: currentType,
            startDate,
            endDate: endTime,
            shifts: [...currentGroup],
            isCurrent: periodStartTime <= now && endTime > now,
            isNext: false
          });
        }
        
        // Start new group
        currentGroup = [shift];
        currentType = shift.shift_type;
      } else {
        // Check if this shift is consecutive (within 1 day of the last shift)
        if (currentGroup.length > 0) {
          const lastShiftDate = currentGroup[currentGroup.length - 1].shift_date.toDate();
          const currentShiftDate = shift.shift_date.toDate();
          const daysDiff = Math.abs((currentShiftDate.getTime() - lastShiftDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 1) {
            currentGroup.push(shift);
          } else {
            // Gap detected, save current group and start new one
            if (currentType) {
              const startDate = currentGroup[0].shift_date.toDate();
              const lastShift = currentGroup[currentGroup.length - 1];
              const endTime = timestampToDate(lastShift.end_time);
              const periodStartTime = timestampToDate(currentGroup[0].start_time);
              
              periods.push({
                type: currentType,
                startDate,
                endDate: endTime,
                shifts: [...currentGroup],
                isCurrent: periodStartTime <= now && endTime > now,
                isNext: false
              });
            }
            
            // Start new group with current shift
            currentGroup = [shift];
          }
        } else {
          currentGroup.push(shift);
        }
      }
    }

    // Don't forget the last group
    if (currentGroup.length > 0 && currentType) {
      const startDate = timestampToDate(currentGroup[0].start_time);
      const lastShift = currentGroup[currentGroup.length - 1];
      const endTime = timestampToDate(lastShift.end_time);
      const periodStartTime = timestampToDate(currentGroup[0].start_time);
      
      periods.push({
        type: currentType,
        startDate,
        endDate: endTime,
        shifts: [...currentGroup],
        isCurrent: periodStartTime <= now && endTime > now,
        isNext: false
      });
    }

    // Sort periods by start date
    periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // Find current and next periods with improved logic
    const currentPeriodIndex = periods.findIndex(p => p.isCurrent);
    
    if (currentPeriodIndex >= 0) {
      currentPeriod = periods[currentPeriodIndex];
      // Look for next period after current
      const nextPeriodIndex = periods.findIndex((p, index) => 
        index > currentPeriodIndex && p.startDate >= currentPeriod!.endDate
      );
      if (nextPeriodIndex >= 0) {
        nextPeriod = periods[nextPeriodIndex];
        nextPeriod.isNext = true;
      }
    } else {
      // If no current period, find the next upcoming one
      const upcomingPeriods = periods.filter(p => p.startDate > now);
      if (upcomingPeriods.length > 0) {
        nextPeriod = upcomingPeriods[0];
        nextPeriod.isNext = true;
      }
      
      // Also check if there's a period that should be current but wasn't detected
      // (in case of edge cases with time comparison)
      const potentialCurrent = periods.find(p => {
        const dayOnly = new Date(p.startDate);
        dayOnly.setHours(0, 0, 0, 0);
        const endDayOnly = new Date(p.endDate);
        endDayOnly.setHours(23, 59, 59, 999);
        return dayOnly <= today && endDayOnly >= today;
      });
      
      if (potentialCurrent && !currentPeriod) {
        currentPeriod = potentialCurrent;
        currentPeriod.isCurrent = true;
        
        // Re-find next period
        const currentIndex = periods.indexOf(currentPeriod);
        const nextIndex = periods.findIndex((p, index) => 
          index > currentIndex && p.startDate >= currentPeriod!.endDate
        );
        if (nextIndex >= 0) {
          nextPeriod = periods[nextIndex];
          nextPeriod.isNext = true;
        }
      }
    }

    return { current: currentPeriod, next: nextPeriod, allPeriods: periods };
  };

  // Function to group shifts by caregiver
  // Helper function to find the next caregiver who will take over after a period ends
  const findNextCaregiverForDate = (date: Date, excludeCaregiverId: string) => {
    // Look for any caregiver who has a next period starting around this date
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    
    for (const caregiver of caregivers) {
      if (caregiver.caregiver_id === excludeCaregiverId) continue;
      
      const { next } = getShiftPeriods(caregiver.caregiver_id);
      if (next && 
          next.startDate.getTime() >= date.getTime() && 
          next.startDate.getTime() <= nextDay.getTime()) {
        return {
          caregiverId: caregiver.caregiver_id,
          shiftType: next.type,
          startDate: next.startDate
        };
      }
    }
    
    return null;
  };

  // Central function to filter only relevant shifts (current and next periods + recent past)
  const getRelevantShifts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seenShiftIds = new Set<string>();
    
    return shifts.filter(shift => {
      if (!isShiftForExistingCaregiver(shift)) {
        return false;
      }

      if (seenShiftIds.has(shift.shift_id)) {
        return false;
      }
      seenShiftIds.add(shift.shift_id);

      const shiftDate = shift.shift_date.toDate();
      const { current, next } = getShiftPeriods(shift.caregiver_id);
      
      // Always show shift if it's part of current period
      if (
        current &&
        timestampToDate(shift.start_time) <= current.endDate &&
        timestampToDate(shift.end_time) >= current.startDate
      ) {
        return true;
      }
      
      // Always show shift if it's part of next period
      if (
        next &&
        timestampToDate(shift.start_time) <= next.endDate &&
        timestampToDate(shift.end_time) >= next.startDate
      ) {
        return true;
      }
      
      // Show recent past shifts (within 3 days) for context
      const daysDiff = Math.floor((today.getTime() - shiftDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff <= 3) {
        return true;
      }
      
      // Hide all other shifts (old past periods, future periods beyond next)
      return false;
    });
  };

  const getGroupedShifts = () => {
    const grouped = new Map<string, { caregiverId: string; caregiverName: string; shifts: CaregiverShift[]; caregiverIds: string[] }>();
    
    // Use only relevant shifts instead of all shifts
    const relevantShifts = getRelevantShifts();
    
    // Sort shifts by date first
    const sortedShifts = [...relevantShifts].sort((a, b) => 
      a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime()
    );
    
    sortedShifts.forEach(shift => {
      const caregiver = caregivers.find(c => c.caregiver_id === shift.caregiver_id);
      const caregiverName = caregiver ? `${caregiver.first_name} ${caregiver.last_name}`.trim() : getCaregiverName(shift.caregiver_id);
      const groupKey = caregiverName.toLowerCase();

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          caregiverId: shift.caregiver_id,
          caregiverName,
          shifts: [],
          caregiverIds: [],
        });
      }

      const group = grouped.get(groupKey)!;
      group.shifts.push(shift);
      if (!group.caregiverIds.includes(shift.caregiver_id)) {
        group.caregiverIds.push(shift.caregiver_id);
      }
    });
    
    return Array.from(grouped.values()).map(({ caregiverId, caregiverName, shifts, caregiverIds }) => ({
      caregiverId,
      caregiverName,
      shifts,
      caregiverIds
    }));
  };

  // Auto-rotation functions
  const isShiftAboutToEnd = (shift: CaregiverShift) => {
    if (!autoRotationSettings.enabled) return false;
    
    const now = new Date();
    const shiftEndTime = shift.end_time instanceof Timestamp ? shift.end_time.toDate() : new Date(shift.end_time);
    const leadTimeMs = autoRotationSettings.leadTimeHours * 60 * 60 * 1000;
    const rotationTriggerTime = new Date(shiftEndTime.getTime() - leadTimeMs);
    
    return now >= rotationTriggerTime && now < shiftEndTime;
  };

  const isShiftPeriodAboutToEnd = (caregiverId: string) => {
    const { current } = getShiftPeriods(caregiverId);
    if (!current || !autoRotationSettings.enabled) return false;
    
    const now = new Date();
    const periodEndTime = current.endDate;
    
    // Check if the period ends within the next 24 hours
    const hoursUntilEnd = (periodEndTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const leadTimeHours = autoRotationSettings.leadTimeHours || 24; // Default to 24 hours if not set
    
    return hoursUntilEnd > 0 && hoursUntilEnd <= leadTimeHours;
  };

  const getNextRotationInfo = (caregiverId: string) => {
    const { current, next } = getShiftPeriods(caregiverId);

    if (next) {
      return {
        label: `Next rotation: ${formatDate(next.startDate)} (${next.type})`,
        variant: 'outline' as const,
        className: 'border-blue-200 bg-blue-50 text-blue-700',
      };
    }

    if (current && isShiftPeriodAboutToEnd(caregiverId)) {
      return {
        label: `Rotates soon: ${formatDate(current.endDate)}`,
        variant: 'destructive' as const,
        className: '',
      };
    }

    if (current) {
      return {
        label: `Next rotation pending`,
        variant: 'secondary' as const,
        className: '',
      };
    }

    return {
      label: 'No rotation scheduled',
      variant: 'outline' as const,
      className: 'border-muted-foreground/30 text-muted-foreground',
    };
  };

  // Helper function to check if a period is currently active
  const isPeriodActive = (period: any) => {
    const now = new Date();
    return period.startDate <= now && period.endDate > now;
  };

  // Helper function to get the most accurate current period
  const getCurrentActivePeriod = (caregiverId: string) => {
    const { current, allPeriods } = getShiftPeriods(caregiverId);
    
    // Double-check if the detected current period is actually active
    if (current && isPeriodActive(current)) {
      return current;
    }
    
    // If not, search through all periods for an active one
    if (allPeriods) {
      const activePeriod = allPeriods.find(period => isPeriodActive(period));
      return activePeriod || null;
    }
    
    return null;
  };

  const getNextCaregiverForRotation = (currentCaregiverId: string) => {
    const availableCaregivers = caregivers.filter(c => c.caregiver_id !== currentCaregiverId);
    
    if (availableCaregivers.length === 0) return null;
    
    if (autoRotationSettings.rotationPattern === 'round-robin') {
      // Find the next caregiver in alphabetical order
      const sortedCaregivers = availableCaregivers.sort((a, b) => 
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      return sortedCaregivers[0];
    } else {
      // Random selection
      const randomIndex = Math.floor(Math.random() * availableCaregivers.length);
      return availableCaregivers[randomIndex];
    }
  };

  const generateInitialShiftPeriod = async (caregiverId: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
    if (!caregiver) return null;

    const caregiverAlreadyHasShifts = shifts.some(shift => shift.caregiver_id === caregiverId);
    if (caregiverAlreadyHasShifts) {
      return null;
    }

    // Start from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Default to Day shift for initial period
    const shiftType = 'Day';
    const shiftDuration = 4; // 4 days per period
    
    const newShifts = [];
    
    for (let i = 0; i < shiftDuration; i++) {
      const shiftDate = new Date(today);
      shiftDate.setDate(today.getDate() + i);
      
      // Set shift times based on type
      const startTime = new Date(shiftDate);
      const endTime = new Date(shiftDate);
      
      if (shiftType === 'Day') {
        startTime.setHours(7, 0, 0, 0); // 7 AM
        endTime.setHours(19, 0, 0, 0);  // 7 PM
      } else {
        startTime.setHours(19, 0, 0, 0); // 7 PM
        endTime.setDate(endTime.getDate() + 1); // Next day
        endTime.setHours(7, 0, 0, 0);   // 7 AM next day
      }

      const newShift = {
        caregiver_id: caregiverId,
        shift_date: Timestamp.fromDate(shiftDate),
        shift_type: shiftType,
        start_time: Timestamp.fromDate(startTime),
        end_time: Timestamp.fromDate(endTime),
        notes: `Auto-generated initial ${shiftType} shift period (${i + 1}/4)`,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };

      newShifts.push(newShift);
    }

    try {
      // Add all shifts in the period
      for (const shift of newShifts) {
        await addCaregiverShift(shift);
      }
      
      return {
        caregiverId: caregiverId,
        shiftType: shiftType,
        startDate: today,
        endDate: new Date(today.getTime() + (shiftDuration * 24 * 60 * 60 * 1000)),
        shiftsCount: newShifts.length
      };
    } catch (error) {
      console.error('Error creating initial shift period:', error);
      return null;
    }
  };

  const generateNextShiftPeriod = async (
    sourceCaregiverId: string,
    targetCaregiverId?: string,
    startDateOverride?: Date
  ) => {
    const { current } = getShiftPeriods(sourceCaregiverId);
    if (!current) return null;

    const assignedCaregiverId = targetCaregiverId || sourceCaregiverId;

    // Generate 4-day shift period starting after current period ends
    const nextPeriodStart = startDateOverride ? new Date(startDateOverride) : new Date(current.endDate);
    const nextShiftType = current.type === 'Day' ? 'Night' : 'Day';
    const shiftDuration = 4; // 4 days per period

    const periodKey = `${sourceCaregiverId}:${assignedCaregiverId}:${nextPeriodStart.toISOString().split('T')[0]}:${nextShiftType}`;
    if (generatedPeriodKeysRef.current.has(periodKey)) {
      return null;
    }

    const alreadyScheduled = shifts.some(shift => {
      if (shift.caregiver_id !== assignedCaregiverId) {
        return false;
      }

      const shiftDate = shift.shift_date.toDate();
      return shiftDate >= nextPeriodStart;
    });

    if (alreadyScheduled) {
      generatedPeriodKeysRef.current.add(periodKey);
      return null;
    }
    
    const newShifts = [];
    
    for (let i = 0; i < shiftDuration; i++) {
      const shiftDate = new Date(nextPeriodStart);
      shiftDate.setDate(nextPeriodStart.getDate() + i);
      
      // Set shift times based on type
      const startTime = new Date(shiftDate);
      const endTime = new Date(shiftDate);
      
      if (nextShiftType === 'Day') {
        startTime.setHours(7, 0, 0, 0); // 7 AM
        endTime.setHours(19, 0, 0, 0);  // 7 PM
      } else {
        startTime.setHours(19, 0, 0, 0); // 7 PM
        endTime.setDate(endTime.getDate() + 1); // Next day
        endTime.setHours(7, 0, 0, 0);   // 7 AM next day
      }

      const newShift = {
        caregiver_id: assignedCaregiverId,
        shift_date: Timestamp.fromDate(shiftDate),
        shift_type: nextShiftType,
        start_time: Timestamp.fromDate(startTime),
        end_time: Timestamp.fromDate(endTime),
        notes: `Auto-generated ${nextShiftType} shift period (${i + 1}/4) - rotation for ${getCaregiverName(assignedCaregiverId)}`,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };

      newShifts.push(newShift);
    }

    try {
      // Add all shifts in the period
      for (const shift of newShifts) {
        await addCaregiverShift(shift);
      }

      generatedPeriodKeysRef.current.add(periodKey);
      
      return {
        caregiverId: assignedCaregiverId,
        shiftType: nextShiftType,
        startDate: nextPeriodStart,
        endDate: new Date(nextPeriodStart.getTime() + (shiftDuration * 24 * 60 * 60 * 1000)),
        shiftsCount: newShifts.length
      };
    } catch (error) {
      console.error('Error creating auto-rotation shift period:', error);
      return null;
    }
  };

  const checkAndProcessAutoRotations = async () => {
    if (!autoRotationSettings.enabled) return;
    if (autoRotationLockRef.current) return;

    autoRotationLockRef.current = true;

    try {
      let hasGeneratedNewShifts = false;

      // Check each caregiver's current shift period
      for (const caregiver of caregivers) {
        const { current, next, allPeriods } = getShiftPeriods(caregiver.caregiver_id);
        const activePeriod = getCurrentActivePeriod(caregiver.caregiver_id) || current;
        const lastPeriod = allPeriods?.[allPeriods.length - 1] || null;
        const periodToRotateFrom = activePeriod || lastPeriod;
        
        const periodEndsSoon = activePeriod && isShiftPeriodAboutToEnd(caregiver.caregiver_id);
        const periodHasEnded = !activePeriod && !!lastPeriod && lastPeriod.endDate <= new Date();

        // Generate the next period when the current block is nearing its end,
        // or when it has already ended and there is no future block yet.
        if (periodToRotateFrom && !next && (periodEndsSoon || periodHasEnded)) {
          const nextCaregiver = getNextCaregiverForRotation(caregiver.caregiver_id);
          const targetCaregiverId = nextCaregiver?.caregiver_id || caregiver.caregiver_id;
          const newPeriod = await generateNextShiftPeriod(
            caregiver.caregiver_id,
            targetCaregiverId,
            periodToRotateFrom.endDate
          );
          if (newPeriod) {
            hasGeneratedNewShifts = true;
            toast({
              title: "Auto-Rotation Activated",
              description: `Next ${newPeriod.shiftType} shift period (${newPeriod.shiftsCount} days) assigned to ${getCaregiverName(newPeriod.caregiverId)}`,
              duration: 5000,
            });
          }
        }
        
        // Also check if we need to generate initial shifts if no current period exists
        if (!current && !next) {
          const initialPeriod = await generateInitialShiftPeriod(caregiver.caregiver_id);
          if (initialPeriod) {
            hasGeneratedNewShifts = true;
            toast({
              title: "Initial Shift Period Created",
              description: `${initialPeriod.shiftType} shift period (${initialPeriod.shiftsCount} days) assigned to ${getCaregiverName(initialPeriod.caregiverId)}`,
              duration: 5000,
            });
          }
        }
      }

      // Reload data if new shifts were generated
      if (hasGeneratedNewShifts) {
        await loadData();
      }
    } finally {
      autoRotationLockRef.current = false;
    }
  };

  // Check for auto-rotations periodically and on mount
  useEffect(() => {
    // Run once on mount
    checkAndProcessAutoRotations();
    
    if (autoRotationSettings.enabled) {
      // Then check every 30 seconds for more responsive automation
      const interval = setInterval(checkAndProcessAutoRotations, 30000);
      return () => clearInterval(interval);
    }
  }, [shifts, autoRotationSettings.enabled, caregivers]);

  // Helper functions
  const formatDate = (date: Date | Timestamp) => {
    const dateObj = date instanceof Timestamp ? date.toDate() : date;
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time: string | Timestamp) => {
    if (typeof time === 'string') {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (time instanceof Timestamp) {
      return time.toDate().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    return '';
  };

  const getShiftTypes = (caregiverShifts: CaregiverShift[]) => {
    return Array.from(new Set(caregiverShifts.map(shift => shift.shift_type)));
  };

  const formatDateRange = (shifts: CaregiverShift[]) => {
    if (shifts.length === 0) return '';
    if (shifts.length === 1) {
      const date = shifts[0].shift_date.toDate();
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const dates = shifts.map(shift => shift.shift_date.toDate()).sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    // If all shifts are on the same day
    if (firstDate.toDateString() === lastDate.toDateString()) {
      return firstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Format as "Sun-Wed" if within same week, or "Dec 1-5" if different weeks
    const firstWeekday = firstDate.toLocaleDateString('en-US', { weekday: 'short' });
    const lastWeekday = lastDate.toLocaleDateString('en-US', { weekday: 'short' });
    
    // Check if they're in the same month
    if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
      return `${firstWeekday} ${firstDate.getDate()}-${lastWeekday} ${lastDate.getDate()}`;
    } else {
      return `${firstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - ${lastDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    }
  };

  const getCaregiverName = (caregiverId: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
    return caregiver ? `${caregiver.first_name} ${caregiver.last_name}` : 'Unknown';
  };

  const isShiftForExistingCaregiver = (shift: CaregiverShift) => {
    return caregivers.some(caregiver => caregiver.caregiver_id === shift.caregiver_id);
  };

  const relevantShifts = useMemo(() => getRelevantShifts(), [shifts, caregivers, autoRotationSettings.enabled]);

  const groupedShifts = useMemo(() => {
    const grouped = new Map<string, { caregiverId: string; caregiverName: string; shifts: CaregiverShift[]; caregiverIds: string[] }>();

    const sortedShifts = [...relevantShifts].sort((a, b) => 
      a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime()
    );

    sortedShifts.forEach(shift => {
      const caregiver = caregivers.find(c => c.caregiver_id === shift.caregiver_id);
      const caregiverName = caregiver ? `${caregiver.first_name} ${caregiver.last_name}`.trim() : getCaregiverName(shift.caregiver_id);
      const groupKey = caregiverName.toLowerCase();

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          caregiverId: shift.caregiver_id,
          caregiverName,
          shifts: [],
          caregiverIds: [],
        });
      }

      const group = grouped.get(groupKey)!;
      group.shifts.push(shift);
      if (!group.caregiverIds.includes(shift.caregiver_id)) {
        group.caregiverIds.push(shift.caregiver_id);
      }
    });

    return Array.from(grouped.values()).map(({ caregiverId, caregiverName, shifts, caregiverIds }) => ({
      caregiverId,
      caregiverName,
      shifts,
      caregiverIds
    }));
  }, [relevantShifts, caregivers]);

  // Calendar helper functions
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      dates.push(day);
    }
    return dates;
  };

  const getRelevantShiftsForCalendar = () => {
    // Show the saved shifts directly in the calendar so overnight edges are not hidden
    return shifts.filter(isShiftForExistingCaregiver);
  };

  const getShiftsForDate = (date: Date) => {
    const relevantShifts = getRelevantShiftsForCalendar();
    return relevantShifts.filter(shift => {
      const shiftDate = shift.shift_date.toDate();
      return shiftDate.toDateString() === date.toDateString();
    });
  };

  const getShiftPeriodMeta = (shift: CaregiverShift) => {
    const caregiverShifts = shifts
      .filter(item => item.caregiver_id === shift.caregiver_id)
      .sort((a, b) => a.shift_date.toDate().getTime() - b.shift_date.toDate().getTime());

    const index = caregiverShifts.findIndex(item => item.shift_id === shift.shift_id);
    if (index === -1) {
      return { position: 1, total: 4 };
    }

    const currentDate = caregiverShifts[index].shift_date.toDate();
    const currentType = caregiverShifts[index].shift_type;

    const isConsecutive = (firstDate: Date, secondDate: Date) => {
      const dayDifference = Math.abs((secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      return dayDifference <= 1;
    };

    let startIndex = index;
    let cursorDate = currentDate;
    while (startIndex > 0) {
      const previousShift = caregiverShifts[startIndex - 1];
      const previousShiftDate = previousShift.shift_date.toDate();

      if (previousShift.shift_type !== currentType || !isConsecutive(previousShiftDate, cursorDate)) {
        break;
      }

      startIndex -= 1;
      cursorDate = previousShiftDate;
    }

    let endIndex = index;
    cursorDate = currentDate;
    while (endIndex < caregiverShifts.length - 1) {
      const nextShift = caregiverShifts[endIndex + 1];
      const candidateDate = nextShift.shift_date.toDate();

      if (nextShift.shift_type !== currentType || !isConsecutive(cursorDate, candidateDate)) {
        break;
      }

      endIndex += 1;
      cursorDate = candidateDate;
    }

    return {
      position: index - startIndex + 1,
      total: 4,
    };
  };

  const getMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  // Shift management functions
  const handleEditShift = (shift: CaregiverShift) => {
    setEditingShift(shift);
    setEditForm({
      caregiverId: shift.caregiver_id,
      date: shift.shift_date.toDate().toISOString().split('T')[0],
      shiftType: shift.shift_type,
      startTime: shift.start_time instanceof Timestamp 
        ? shift.start_time.toDate().toTimeString().split(' ')[0].substring(0, 5)
        : shift.start_time,
      endTime: shift.end_time instanceof Timestamp 
        ? shift.end_time.toDate().toTimeString().split(' ')[0].substring(0, 5)
        : shift.end_time,
      notes: shift.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!editingShift) return;

    try {
      const shiftDate = new Date(editForm.date);
      const startTime = new Date(`${editForm.date}T${editForm.startTime}`);
      const endTime = new Date(`${editForm.date}T${editForm.endTime}`);
      
      if (editForm.shiftType === 'Night' && editForm.endTime < editForm.startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }

      const updatedShift = {
        ...editingShift,
        caregiver_id: editForm.caregiverId,
        shift_date: Timestamp.fromDate(shiftDate),
        shift_type: editForm.shiftType,
        start_time: Timestamp.fromDate(startTime),
        end_time: Timestamp.fromDate(endTime),
        notes: editForm.notes,
        updated_at: Timestamp.now()
      };

      await updateCaregiverShift(editingShift.shift_id, updatedShift);
      await loadData();
      
      // Check if we need to generate new shifts after update
      if (autoRotationSettings.enabled) {
        setTimeout(() => {
          checkAndProcessAutoRotations();
        }, 1000); // Wait for data to be updated
      }
      
      setIsEditDialogOpen(false);
      setEditingShift(null);

      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
    } catch (error) {
      console.error('Error updating shift:', error);
      toast({
        title: "Error",
        description: "Failed to update shift",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    try {
      await deleteCaregiverShift(shiftId);
      await loadData();
      
      // Check if we need to regenerate shifts after deletion
      if (autoRotationSettings.enabled) {
        setTimeout(() => {
          checkAndProcessAutoRotations();
        }, 1000); // Wait for data to be updated
      }
      
      toast({
        title: "Success",
        description: "Shift deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive",
      });
    }
  };

  const handleViewAllShifts = (caregiverId: string, shifts: CaregiverShift[]) => {
    setSelectedCaregiverShifts({ caregiverId, shifts });
    setIsViewAllDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Clock className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading caregiver shifts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caregiver Schedule</h1>
          <p className="text-muted-foreground">Manage caregiver shifts and assignments</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              setLoading(true);
              await loadData();
              await checkAndProcessAutoRotations();
              setLoading(false);
              toast({
                title: "Refreshed",
                description: "Schedule data has been refreshed",
              });
            }}
            disabled={loading}
          >
            <Clock className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {/* <Button variant="outline" onClick={() => setIsAutoRotationDialogOpen(true)}>
            <Clock className="h-4 w-4 mr-2" />
            Auto-Rotation Settings
          </Button> */}
          {/* <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Shift
          </Button> */}
        </div>
      </div>

      {/* View Toggle and Content */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'table' | 'calendar')} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="table" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Caregiver Schedule Overview
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Simple table view of caregiver shifts
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {relevantShifts.length} shifts
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {relevantShifts.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">No Active Shifts</h3>
                  <p className="text-muted-foreground">
                    No caregiver shifts found for the current schedule.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Caregiver</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Shift Type</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedShifts.map(({ caregiverId, caregiverName, shifts: caregiverShifts, caregiverIds }) => {
                        const firstShift = caregiverShifts[0];
                        const caregiver = caregivers.find(c => c.caregiver_id === caregiverId);
                        const shiftTypes = getShiftTypes(caregiverShifts);
                        const shiftTypeLabel = shiftTypes.length > 0
                          ? `${shiftTypes.join(' / ')} Shift${shiftTypes.length > 1 ? 's' : ''}`
                          : 'Caregiver';
                        const shiftDate = firstShift.shift_date.toDate();
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isPastShift = shiftDate < today;
                        const isAboutToEnd = isShiftAboutToEnd(firstShift);
                        const nextRotationInfo = getNextRotationInfo(caregiverId);

                        return (
                          <TableRow key={caregiverId} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                                  {caregiver?.first_name?.charAt(0)}{caregiver?.last_name?.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-medium">{caregiverName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {caregiverIds.length > 1
                                      ? `${caregiverIds.length} merged records`
                                      : shiftTypeLabel}
                                  </div>
                                  <div className="mt-1">
                                    <Badge
                                      variant={nextRotationInfo.variant}
                                      className={`text-[10px] font-medium ${nextRotationInfo.className}`.trim()}
                                    >
                                      {nextRotationInfo.label}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(firstShift.shift_date)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {shiftTypes.map((shiftType) => (
                                  <Badge key={shiftType} variant={shiftType === 'Day' ? 'default' : 'secondary'}>
                                    {shiftType}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{formatTime(firstShift.start_time)} - {formatTime(firstShift.end_time)}</TableCell>
                            <TableCell>
                              {isPastShift ? (
                                <Badge variant="outline">Completed</Badge>
                              ) : isAboutToEnd ? (
                                <Badge variant="destructive">Ending Soon</Badge>
                              ) : (
                                <Badge variant="secondary">Scheduled</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditShift(firstShift)}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewAllShifts(caregiverId, caregiverShifts)}
                                >
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Caregiver Calendar View
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Weekly calendar showing caregiver shifts
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[180px] text-center font-semibold">
                    {getMonthYear(currentDate)}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {getWeekDates(currentDate).map((date) => {
                  const dayShifts = getShiftsForDate(date);
                  const isToday = date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={date.toISOString()}
                      className={`rounded-lg border p-3 ${isToday ? 'border-primary bg-primary/5' : 'bg-card'}`}
                    >
                      <div className="text-sm font-medium text-muted-foreground">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="text-xl font-bold mb-3">
                        {date.getDate()}
                      </div>

                      <div className="space-y-2">
                        {dayShifts.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No shifts</div>
                        ) : (
                          dayShifts.map((shift) => {
                            const periodMeta = getShiftPeriodMeta(shift);
                            const isNightShift = shift.shift_type === 'Night';
                            const nextRotationInfo = getNextRotationInfo(shift.caregiver_id);
                            const shiftCardClass = isNightShift
                              ? 'rounded-md border border-slate-600 bg-slate-950/90 p-2 text-xs text-slate-50 shadow-sm shadow-slate-950/20'
                              : 'rounded-md border border-primary/20 bg-primary/10 p-2 text-xs shadow-sm';

                            return (
                              <div
                                key={shift.shift_id}
                                className={shiftCardClass}
                              >
                                <div className="font-medium truncate">
                                  {getCaregiverName(shift.caregiver_id)}
                                </div>
                                <div className={isNightShift ? 'text-slate-300' : 'text-muted-foreground'}>
                                  {shift.shift_type} • {formatTime(shift.start_time)}-{formatTime(shift.end_time)}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <Badge variant={shift.shift_type === 'Day' ? 'default' : 'secondary'}>
                                    {shift.shift_type}
                                  </Badge>
                                  <span className={isNightShift ? 'text-[10px] text-slate-300' : 'text-[10px] text-muted-foreground'}>
                                    {periodMeta.position}/{periodMeta.total} day{periodMeta.total !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <Badge
                                    variant={nextRotationInfo.variant}
                                    className={`text-[10px] font-medium ${nextRotationInfo.className}`.trim()}
                                  >
                                    {nextRotationInfo.label}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-Rotation Settings Dialog */}
      <Dialog open={isAutoRotationDialogOpen} onOpenChange={setIsAutoRotationDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Auto-Rotation Settings</DialogTitle>
            <DialogDescription>
              Configure automatic caregiver shift rotation when shifts are about to end.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRotationEnabled"
                checked={autoRotationSettings.enabled}
                onChange={(e) => setAutoRotationSettings(prev => ({ 
                  ...prev, 
                  enabled: e.target.checked 
                }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="autoRotationEnabled" className="text-sm font-medium">
                Enable automatic rotation
              </Label>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="leadTime" className="text-right text-sm">
                Lead Time (hours)
              </Label>
              <Input
                id="leadTime"
                type="number"
                min="1"
                max="12"
                value={autoRotationSettings.leadTimeHours}
                onChange={(e) => setAutoRotationSettings(prev => ({ 
                  ...prev, 
                  leadTimeHours: parseInt(e.target.value) || 4 
                }))}
                className="col-span-3"
                disabled={!autoRotationSettings.enabled}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rotationPattern" className="text-right text-sm">
                Rotation Pattern
              </Label>
              <Select 
                value={autoRotationSettings.rotationPattern} 
                onValueChange={(value: 'round-robin' | 'random') => 
                  setAutoRotationSettings(prev => ({ ...prev, rotationPattern: value }))
                }
                disabled={!autoRotationSettings.enabled}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round-robin">Round Robin (Alphabetical)</SelectItem>
                  <SelectItem value="random">Random Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-xs text-muted-foreground mt-2">
              <p>• Lead time determines how many hours before shift end to trigger rotation</p>
              <p>• Round robin selects next caregiver alphabetically</p>
              <p>• Random selection picks any available caregiver</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAutoRotationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setIsAutoRotationDialogOpen(false);
              toast({
                title: "Settings Updated",
                description: `Auto-rotation ${autoRotationSettings.enabled ? 'enabled' : 'disabled'}`,
              });
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View All Shifts Dialog */}
      <Dialog open={isViewAllDialogOpen} onOpenChange={setIsViewAllDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              All Shifts for {getCaregiverName(selectedCaregiverShifts.caregiverId)}
            </DialogTitle>
            <DialogDescription>
              {selectedCaregiverShifts.shifts.length} total shift{selectedCaregiverShifts.shifts.length !== 1 ? 's' : ''}
            </DialogDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              {getShiftTypes(selectedCaregiverShifts.shifts).map((shiftType) => (
                <Badge key={shiftType} variant={shiftType === 'Day' ? 'default' : 'secondary'}>
                  {shiftType}
                </Badge>
              ))}
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCaregiverShifts.shifts.map((shift) => (
                  <TableRow key={shift.shift_id}>
                    <TableCell>{formatDate(shift.shift_date)}</TableCell>
                    <TableCell>
                      <Badge variant={shift.shift_type === 'Day' ? 'default' : 'secondary'}>
                        {shift.shift_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm text-muted-foreground">
                        {shift.notes || 'No notes'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsViewAllDialogOpen(false);
                            handleEditShift(shift);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteShift(shift.shift_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewAllDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="caregiver" className="text-right">
                Caregiver
              </Label>
              <Select 
                value={editForm.caregiverId} 
                onValueChange={(value) => setEditForm(prev => ({ ...prev, caregiverId: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caregivers.map(caregiver => (
                    <SelectItem key={caregiver.caregiver_id} value={caregiver.caregiver_id}>
                      {caregiver.first_name} {caregiver.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="shiftType" className="text-right">
                Shift Type
              </Label>
              <Select 
                value={editForm.shiftType} 
                onValueChange={(value: 'Day' | 'Night') => setEditForm(prev => ({ ...prev, shiftType: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day Shift</SelectItem>
                  <SelectItem value="Night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startTime" className="text-right">
                Start Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endTime" className="text-right">
                End Time
              </Label>
              <Input
                id="endTime"
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Input
                id="notes"
                placeholder="Optional notes..."
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveShift}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;