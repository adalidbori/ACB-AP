const collapsedVendorsState  = new Set();
document.addEventListener('DOMContentLoaded', () => {
    // 1. Añade los listeners a los encabezados ESTÁTICOS de la tabla una vez.
    initializeTableSorting();

    // 2. Carga los datos iniciales de la tabla.
    loadInvoices();
});

const tableBody = document.querySelector('tbody');

function clearFilter() {
  // Restablecer los valores de los inputs del filtro
  document.getElementById('filter-vendor').value = '';
  document.getElementById('filter-invoiceNumber').value = '';
  document.getElementById('filter-invoiceDate').value = '';

  // Llamar a loadInvoices para recargar las facturas sin ningún filtro aplicado
  loadInvoices();
}

//Cargar elementos pending to review de la base de datos
async function loadInvoices() {
  
  try {
    const vendor = document.getElementById('filter-vendor').value;
    const invoiceNumber = document.getElementById('filter-invoiceNumber').value;
    const invoiceDate = document.getElementById('filter-invoiceDate').value;
    console.log("Vendor: " + vendor);
    console.log("invoiceNumber: " + invoiceNumber);
    console.log("invoiceDate: " + invoiceDate);
    const params = new URLSearchParams({
      vendor,
      invoiceNumber,
      invoiceDate
    });
    const response = await fetch(`/invoices/status/2?${params.toString()}`);
    invoices = await response.json();
    console.log(invoices);
    const tableResult = groupByVendors(invoices);
    fillTable(tableResult, collapsedVendorsState );
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
  }
}
function sortTableByColumn(colID, order) {
  console.log(`Ordenando columna ${colID} en modo ${order}`);
  const aux = ordenarLista(invoices, colID, order);
  const tableResult = groupByVendors(aux);
  fillTable(tableResult, collapsedVendorsState );
  // Aquí irá la lógica de extracción de filas, comparación y re-inserción
}

