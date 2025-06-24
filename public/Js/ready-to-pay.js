const collapsedVendorsState  = new Set();
document.addEventListener('DOMContentLoaded', () => {
  let tableResult = {};
  // 1. Añade los listeners a los encabezados ESTÁTICOS de la tabla una vez.
  initializeTableSorting();

  // 2. Carga los datos iniciales de la tabla.
  loadInvoices();
  exportExcelBtn();
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
    const response = await fetch(`/invoices/status/3?${params.toString()}`);
    invoices = await response.json();

    tableResult = groupByVendors(invoices);
    console.log(tableResult);
    fillTable(tableResult, collapsedVendorsState );
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
  }
}

// CÓDIGO CORREGIDO: Versión más segura para evitar la corrupción de archivos en Excel.
function exportDataToExcel() {
  console.log("Iniciando la exportación (versión segura):", tableResult);

  if (!tableResult || Object.keys(tableResult).length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // 1. Aplanar los datos con VALIDACIÓN
  const flatData = [];
  for (const vendorName in tableResult) {
    const vendorDataObject = tableResult[vendorName];
    if (vendorDataObject && Array.isArray(vendorDataObject.invoices)) {
      vendorDataObject.invoices.forEach(invoice => {

        // --- INICIO DE LA VALIDACIÓN DE DATOS ---
        const invoiceDateObj = new Date(invoice.invoiceDate);
        const dueDateObj = new Date(invoice.dueDate);

        const validInvoiceDate = !isNaN(invoiceDateObj) ? invoiceDateObj : null; // Si la fecha es inválida, usa null
        const validDueDate = !isNaN(dueDateObj) ? dueDateObj : null;       // Si la fecha es inválida, usa null
        // --- FIN DE LA VALIDACIÓN DE DATOS ---

        flatData.push({
          "Vendor": vendorName,
          "Invoice Number": invoice.invoiceNumber,
          "Reference": invoice.referenceNumber,
          "File Name": invoice.docName,
          "Notes": invoice.content,
          "Total": parseFloat(invoice.invoiceTotal) || 0,
          "Invoice Date": validInvoiceDate, // Usamos la fecha validada
          "Due Date": validDueDate         // Usamos la fecha validada
        });
      });
    }
  }

  // 2. Crear la hoja de cálculo
  const ws = XLSX.utils.json_to_sheet(flatData);

  // 3. Definir el rango de la tabla
  const tableRange = `A1:H${flatData.length + 1}`;

  // 4. Añadir la propiedad !table (versión simplificada y segura)
  // El 'autofilter' se añade automáticamente al crear una tabla, pero podemos dejarlo para asegurar.
  ws['!autofilter'] = { ref: tableRange };
  ws['!table'] = {
    ref: tableRange,
    name: "InvoicesData",
    displayName: "InvoicesData",
    // 'totalsRow' ha sido eliminado para aumentar la compatibilidad
  };

  // 5. Aplicar formato a las columnas (este bucle es seguro)
  const dataRange = XLSX.utils.decode_range(ws['!ref']);
  for (let R = dataRange.s.r + 1; R <= dataRange.e.r; ++R) {
    // Formato Moneda para Columna F (Total)
    const cellTotal = ws[XLSX.utils.encode_cell({ c: 5, r: R })];
    if (cellTotal && typeof cellTotal.v === 'number') {
      cellTotal.z = '"$"#,##0.00';
    }

    // Formato Fecha para Columna G (Invoice Date)
    const cellInvoiceDate = ws[XLSX.utils.encode_cell({ c: 6, r: R })];
    if (cellInvoiceDate && cellInvoiceDate.v instanceof Date) {
      cellInvoiceDate.z = 'mm-dd-yyyy';
    }

    // Formato Fecha para Columna H (Due Date)
    const cellDueDate = ws[XLSX.utils.encode_cell({ c: 7, r: R })];
    if (cellDueDate && cellDueDate.v instanceof Date) {
      cellDueDate.z = 'mm-dd-yyyy';
    }
  }

  // 6. Ajustar ancho de columnas
  ws['!cols'] = [
    { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
    { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];

  // 7. Crear y descargar el libro de trabajo
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ready To Pay");
  XLSX.writeFile(wb, "Invoices_Report.xlsx");
}


// No olvides asegurarte de que tu botón llame a esta función
function exportExcelBtn() {
  const exportButton = document.getElementById('exportExcelBtn');
  if (exportButton) {
    exportButton.addEventListener('click', (evento) => {
      evento.preventDefault();
      // Llama a la función correcta
      exportDataToExcel();
    });
  }
}


//Se creo uno separado porque de ready-to-paid a paid se necesita numero de cheque
async function updateToPaid(invoiceStatus) {

  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToEdit = [];
  checkboxes.forEach(chk => {
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      if (id) {
        idsToEdit.push(parseInt(id, 10));
      }
    }
  });

  if (idsToEdit.length === 0) {
    alert("At least one row most be selected!");
    return;
  }

  async function getCheckNumber() {
    try {
      const response = await fetch(`/getCheckNumber`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      const result = await response.json();
      console.log("Check number result:", result);
      return result && result.check_number ? result.check_number + 1 : null; // Incrementa en 1
    } catch (error) {
      console.error("Error getting check numbers!", error);
      return null;
    }
  }

  const modalEl = document.getElementById('addCheckModalId');

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('#saveCheckButton');
  saveButton.onclick = async () => {
    const texto = document.getElementById('checknumberInput');
    const valor = texto.value.trim(); // Elimina espacios al inicio y al final

    // Validaciones
    if (valor === "") {
      alert("The field cannot be empty");
      return; // Detiene la ejecución si está vacío
    }

    // Convertir a número y validar
    const numero = Number(valor); // Intenta convertir el valor a número

    if (isNaN(numero)) {
      alert("The value must be a number");
      return;
    }

    if (!Number.isInteger(numero)) {
      alert("The value must be an integer");
      return;
    }

    // Opcional: Validar que sea positivo
    if (numero <= 0) {
      alert("The value must be a positive number");
      return;
    }

    // Si pasa todas las validaciones, proceder con la solicitud
    try {
      const response = await fetch(`/editCheckNumber`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idsToEdit, valor }) // Enviar el número, no el string
      });

      const result = await response.json();
      console.log("Resultado de la actualización:", result);
      modal.hide();
      sendEmailToTruvis(valor);
      //loadInvoices();
    } catch (error) {
      console.error("Error editando los vendors!", error);
    }
  };
  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);

  // Agrega el listener para limpiar el contenido del modal cuando se cierra
  modalEl.addEventListener('hidden.bs.modal', () => {
    // Reinicia el valor del input (y otros elementos si es necesario)
    const input = modalEl.querySelector('#checknumberInput');
    if (input) {
      input.value = '';
    }
    // Si agregaste otros elementos o estados, reinícialos aquí
  }, { once: true }); // Con { once: true } nos aseguramos que el listener se ejecute solo una vez

  modalEl.addEventListener('show.bs.modal', async () => {
    const texto = document.getElementById('checknumberInput');
    const ultimoCheque = await getCheckNumber(); // Obtener el último número de cheque
    if (ultimoCheque === null) {
      alert("Error al obtener el último número de cheque");
      texto.value = ''; // Limpia el campo en caso de error
    } else {
      texto.value = ultimoCheque; // Asigna el número incrementado al input
    }
  });
  modal.show();
}

async function sendEmailToTruvis(checkNumber) {
  showSpinner();
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const invoices = [];
  checkboxes.forEach(chk => {
    if (chk.checked) {
      console.log(chk);
      const row = chk.closest('tr');
      const url = row.dataset.url;
      //const docName = row.querySelector('[data-field="docName"]').textContent.trim();
      const docName = row.dataset.timestampName;
      if (url && docName) {
        invoices.push({ url, docName });
      }
    }
  });
  try {
    const subject = checkNumber;
    const sendEmailresponse = await fetch(`/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, invoices }) // Enviar el número, no el string
    });
    const result = await sendEmailresponse.json();
    if (result.ok) {
      showMessage(`Data sync to Truvis!`, 'success');
      hideSpinner();
      loadInvoices();
    } else {
      showMessage(`Error syncing to Truvis: ${result.error}`, 'error');
      hideSpinner();
    }

  } catch (error) {
    console.error("Error sending the files to Truvis", error);
  }
}
function sortTableByColumn(colID, order) {
  console.log(`Ordenando columna ${colID} en modo ${order}`);
  const aux = ordenarLista(invoices, colID, order);
  const tableResult = groupByVendors(aux);
  fillTable(tableResult, collapsedVendorsState );
  // Aquí irá la lógica de extracción de filas, comparación y re-inserción
}

function showMessage(msg, type = 'success') {
  const el = document.getElementById('emailStatus');
  el.textContent = msg;
  el.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
  el.style.display = 'block';

  // Oculta después de 4s
  setTimeout(() => {
    el.style.display = 'none';
  }, 4000);
}

function showSpinner() {
  document.getElementById('spinnerOverlay').style.visibility = 'visible';
}

function hideSpinner() {
  document.getElementById('spinnerOverlay').style.visibility = 'hidden';
}