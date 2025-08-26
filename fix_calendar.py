#!/usr/bin/env python3

import re

# Read the file
with open('src/pages/Schedule.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find the calendar section
pattern = r'(.*?)(\{/\* NEW: Selected Caregiver Calendar \*/\}.*?)(\{selectedCaregiversForCalendar\.length > 0 && \(\(\) => \{.*?\}\)\(\)\})(.*)'

match = re.search(pattern, content, re.DOTALL)

if match:
    before_section = match.group(1)
    comment_line = match.group(2)
    calendar_section = match.group(3)
    after_section = match.group(4)
    
    # Create the new calendar section
    new_calendar_section = """{selectedCaregiversForCalendar.length > 0 && (
              <div className="space-y-6 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    📅 {selectedCaregiversForCalendar.length === 1 ? 'Calendar' : 'Calendars'} ({selectedCaregiversForCalendar.length} selected)
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCaregiversForCalendar([])}
                  >
                    Hide All
                  </Button>
                </div>
                
                {selectedCaregiversForCalendar.map(caregiverId => {
                  const selectedCaregiver = filteredCaregivers.find(c => c.caregiver_id === caregiverId)
                  if (!selectedCaregiver) return null
                  
                  return (
                    <div key={caregiverId} className="space-y-4 border rounded-lg p-4 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-medium">
                          📅 {selectedCaregiver.first_name} {selectedCaregiver.last_name}
                        </h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedCaregiversForCalendar(prev => 
                            prev.filter(id => id !== caregiverId)
                          )}
                        >
                          ❌ Hide
                        </Button>
                      </div>
                      
                      {/* Week Header */}
                      <div className="grid grid-cols-7 gap-4">
                        {weekDates.map((date, index) => (
                          <div key={index} className="text-center">
                            <div className="font-medium text-sm">{formatDate(date)}</div>
                            <div className="text-xs text-muted-foreground">
                              {date.toDateString() === new Date().toDateString() && (
                                <Badge variant="outline" className="text-xs">Today</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Calendar Row for This Caregiver */}
                      <div className="grid grid-cols-7 gap-4 py-3 border rounded-lg bg-muted/20">
                        {weekDates.map((date, index) => {
                          const assignedPatients = getAssignedPatients(selectedCaregiver.caregiver_id, selectedCaregiver.shift_type)
                          const isShiftDay = hasShiftOnDate(selectedCaregiver, date)
                          const isShiftExpired = hasShiftEnded(selectedCaregiver)
                          const isTodayLastDay = isLastDayOfShift(selectedCaregiver) && date.toDateString() === new Date().toDateString()
                          
                          return (
                            <div key={index} className="min-h-[120px]">
                              {isShiftDay ? (
                                <div className={`
                                  w-full h-full rounded-md p-2 text-xs 
                                  ${selectedCaregiver.shift_type === 'Day' 
                                    ? 'bg-yellow-100 border border-yellow-300 text-yellow-900' 
                                    : 'bg-purple-100 border border-purple-300 text-purple-900'
                                  }
                                `}>
                                  <div className="font-semibold mb-1">
                                    {selectedCaregiver.shift_type} Shift
                                  </div>
                                  <div className="text-xs opacity-75 mb-2">
                                    {getShiftTimes(selectedCaregiver.shift_type)}
                                  </div>
                                  
                                  {/* Patient assignments */}
                                  {assignedPatients.length > 0 && !isShiftExpired && (
                                    <div className="mt-1 space-y-1">
                                      <div className="text-xs font-medium">Patients:</div>
                                      {assignedPatients.slice(0, 2).map((patient, idx) => (
                                        <div key={idx} className="text-xs bg-white/20 rounded px-1 py-0.5">
                                          {patient.first_name} {patient.last_name.charAt(0)}.
                                        </div>
                                      ))}
                                      {assignedPatients.length > 2 && (
                                        <div className="text-xs opacity-75">
                                          +{assignedPatients.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Status badges */}
                                  <div className="text-xs space-y-1 mt-2">
                                    {isShiftExpired ? (
                                      <Badge className="bg-blue-100 text-blue-800 border-blue-600 text-xs">
                                        Auto-Rotating
                                      </Badge>
                                    ) : isTodayLastDay ? (
                                      <Badge className="bg-orange-100 text-orange-800 border-orange-600 text-xs">
                                        Last Day
                                      </Badge>
                                    ) : canCaregiverTakeMorePatients(selectedCaregiver) ? (
                                      <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                        Available
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                                        Full
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-full rounded-md border border-dashed border-gray-300 
                                  flex items-center justify-center text-xs text-muted-foreground">
                                  Off
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}"""

    # Construct the new file content
    new_content = before_section + comment_line.replace("Selected Caregiver Calendar", "Multiple Selected Caregivers Calendars") + new_calendar_section + after_section
    
    # Write the modified content
    with open('src/pages/Schedule_fixed.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ Fixed calendar section created in Schedule_fixed.tsx")
else:
    print("❌ Could not find calendar section pattern")
