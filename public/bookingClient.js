class BookingCalendar {
    constructor(socketInstance, uiCallbacks) {
        this.socket = socketInstance;
        this.ui = uiCallbacks;
        this.selectedService = null;
        this.availableDates = [];
        
        this.socket.on('availableDatesResponse', (dates) => {
            this.availableDates = dates;
            this.ui.onDatesLoaded(dates);
        });

        this.socket.on('bookingSubmitted', (response) => {
            this.ui.onRequestPending(response);
        });
        
        this.socket.on('bookingApproved', (response) => {
            this.ui.onAutoApproved(response);
        });
    }

    selectService(serviceName) {
        this.selectedService = serviceName;
        const today = new Date().toISOString().split('T')[0];
        
        this.ui.onLoadingDates();
        this.socket.emit('requestAvailableDates', { 
            serviceName: this.selectedService, 
            startDate: today 
        });
    }

    isDateAvailable(dateString) {
        return this.availableDates.includes(dateString);
    }

    submitRequest(userData, dateString) {
        if (!this.selectedService || !this.isDateAvailable(dateString)) {
            this.ui.onError("Invalid service or date selection.");
            return;
        }

        const requestPayload = {
            name: userData.name,
            contact: userData.contact,
            priority: userData.priority,
            document: this.selectedService,
            date: dateString
        };

        this.socket.emit('submitBookingRequest', requestPayload);
    }
}