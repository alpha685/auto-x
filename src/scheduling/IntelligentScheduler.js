class IntelligentScheduler {
    constructor() {
        this.activityHistory = [];
        this.rateWindows = {
            hour: { limit: 15, actions: [] },
            day: { limit: 30, actions: [] },
            week: { limit: 200, actions: [] }
        };
    }

    async shouldPerformAction(actionType) {
        this.cleanupOldActions();
        
        // Check if we're within limits
        for (const [window, config] of Object.entries(this.rateWindows)) {
            if (config.actions.length >= config.limit) {
                console.log(`Rate limit reached for ${window}: ${config.actions.length}/${config.limit}`);
                return false;
            }
        }

        // Check for suspicious patterns
        if (this.detectSuspiciousPattern()) {
            console.log("Suspicious pattern detected, slowing down...");
            await this.adaptiveDelay();
            return false;
        }

        return true;
    }

    recordAction(actionType) {
        const timestamp = Date.now();
        const action = { type: actionType, timestamp };
        
        // Add to all time windows
        Object.values(this.rateWindows).forEach(window => {
            window.actions.push(action);
        });
        
        this.activityHistory.push(action);
    }

    cleanupOldActions() {
        const now = Date.now();
        const windows = {
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000
        };

        Object.entries(this.rateWindows).forEach(([window, config]) => {
            const cutoff = now - windows[window];
            config.actions = config.actions.filter(action => action.timestamp > cutoff);
        });
    }

    detectSuspiciousPattern() {
        const recentActions = this.rateWindows.hour.actions.slice(-10);
        
        if (recentActions.length < 5) return false;

        // Check for too regular timing
        const intervals = recentActions.slice(1).map((action, i) => 
            action.timestamp - recentActions[i].timestamp
        );
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => 
            sum + Math.pow(interval - avgInterval, 2), 0
        ) / intervals.length;
        
        // If variance is too low, timing is too regular
        return variance < (avgInterval * 0.1);
    }

    async adaptiveDelay() {
        // Implement exponential backoff with jitter
        const baseDelay = 5 * 60 * 1000; // 5 minutes
        const jitter = Math.random() * 2 * 60 * 1000; // ±2 minutes
        const delay = baseDelay + jitter;
        
        console.log(`Adaptive delay: ${Math.floor(delay / 1000)} seconds`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    getOptimalSchedule(actions) {
        // Distribute actions throughout the day using natural patterns
        const workingHours = this.generateWorkingHours();
        const schedule = [];
        
        actions.forEach((action, index) => {
            const timeSlot = this.selectNaturalTimeSlot(workingHours, index);
            schedule.push({
                ...action,
                scheduledTime: timeSlot,
                priority: this.calculatePriority(action)
            });
        });
        
        return schedule.sort((a, b) => a.scheduledTime - b.scheduledTime);
    }

    generateWorkingHours() {
        // Generate realistic working hour patterns
        const today = new Date();
        const workingHours = [];
        
        // Morning burst (9-11 AM)
        this.addTimeSlots(workingHours, today, 9, 11, 0.4);
        
        // Lunch break gap (12-1 PM) - reduced activity
        this.addTimeSlots(workingHours, today, 12, 13, 0.1);
        
        // Afternoon activity (2-5 PM)
        this.addTimeSlots(workingHours, today, 14, 17, 0.3);
        
        // Evening wind-down (6-7 PM)
        this.addTimeSlots(workingHours, today, 18, 19, 0.2);
        
        return workingHours;
    }

    addTimeSlots(slots, date, startHour, endHour, weight) {
        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeSlot = new Date(date);
                timeSlot.setHours(hour, minute, 0, 0);
                
                slots.push({
                    time: timeSlot.getTime(),
                    weight: weight * (0.8 + Math.random() * 0.4) // Add randomness
                });
            }
        }
    }

    selectNaturalTimeSlot(workingHours, index) {
        // Simple implementation - just return current time plus some delay
        return Date.now() + (index * 60000); // 1 minute intervals
    }

    calculatePriority(action) {
        // Simple priority calculation
        return action.type === 'dm' ? 1 : 2;
    }
}

module.exports = { IntelligentScheduler };