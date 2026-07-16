export const exportService = {
  downloadCSV(data: any[], filename: string) {
    if (!data.length) return;

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj =>
      Object.values(obj).map(val => `"${val}"`).join(',')
    ).join('\n');

    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  downloadExcel(data: any[], filename: string) {
    // Basic CSV as XLS (Excel compatible)
    this.downloadCSV(data, filename);
  },

  printPDF(elementId: string) {
    window.print();
  }
};
