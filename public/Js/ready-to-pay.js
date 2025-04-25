document.addEventListener('DOMContentLoaded', loadInvoices);
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
    const response = await fetch(`http://${window.miVariable}:3000/invoices/status/3?${params.toString()}`);
    invoices = await response.json();
    console.log(invoices);
    const tableResult = groupByVendors(invoices);
    fillTable(tableResult);
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
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
      const response = await fetch(`http://${window.miVariable}:3000/getCheckNumber`, {
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
      const response = await fetch(`http://${window.miVariable}:3000/editCheckNumber`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idsToEdit, valor }) // Enviar el número, no el string
      });

      const result = await response.json();
      console.log("Resultado de la actualización:", result);
      modal.hide();
      loadInvoices();
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