// In GoogleSheetsManager.js
async getKillSwitchStatus() {
    try {
        const controlSheet = this.doc.sheetsByTitle['Control'];
        await controlSheet.loadCells('A1');
        const status = controlSheet.getCell(0, 0).value;
        return status === 'STOP' || status === 'PAUSE';
    } catch (error) {
        // If check fails, default to running (fail-safe)
        console.warn('Kill switch check failed, continuing operation');
        return false;
    }
}

