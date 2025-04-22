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
    const invoices = await response.json();
    tableBody.innerHTML = ""; // Limpiar contenido previo

    // Agrupar facturas por vendor y sumar los totales usando el formato internacional
    const invoiceSummary = invoices.reduce((accumulator, invoice) => {
      // 'accumulator' ahora contiene tanto los grupos como el total general.
      // Estructura esperada de accumulator: { groups: { ... }, totalOwe: 0 }

      const vendor = invoice.vendor;

      // Accedemos al objeto de grupos DENTRO del acumulador
      if (!accumulator.groups[vendor]) {
        accumulator.groups[vendor] = { invoices: [], total: 0 };
      }

      // Agregamos la factura al grupo correspondiente dentro del acumulador
      accumulator.groups[vendor].invoices.push(invoice);

      // Convertimos el invoiceTotal a número (asumiendo que parseInternationalCurrency devuelve un número)
      // Esta función ya debería manejar la conversión a float/número.
      const amount = parseInternationalCurrency(invoice.invoiceTotal);

      // Sumamos al total del vendor específico
      accumulator.groups[vendor].total += amount;

      // *** NUEVO: Sumamos al total general (totalOwe) en el acumulador ***
      accumulator.totalOwe += amount;

      // Devolvemos el acumulador completo para la siguiente iteración
      return accumulator;

    }, { groups: {}, totalOwe: 0 }); // <--- Valor inicial del acumulador modificado

    // Después del reduce, los resultados están en 'invoiceSummary'
    const groupedInvoices = invoiceSummary.groups; // Los grupos como antes
    const totalSpan = document.querySelector('.total-span');
    const totalOwe = `$${invoiceSummary.totalOwe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;     // El total general calculado
    totalSpan.textContent = totalOwe;
    console.log("Total Adeudado General:", totalOwe);

    // Recorrer cada grupo y agregar las filas en la tabla
    for (const vendor in groupedInvoices) {
      // Crear fila de cabecera para cada vendor
      const headerRow = document.createElement("tr");
      headerRow.classList.add("vendor-header");
      headerRow.dataset.vendor = vendor;
      headerRow.innerHTML = `
        <td colspan="9" style="background:#f0f0f0;">
          <input type="checkbox" class="vendor-checkbox" data-vendor="${vendor}" style="margin-right: 10px; cursor: pointer;">
          <strong style="cursor: pointer;">${vendor}</strong>
        </td>`;

      // ---- Obtener referencias al área clickeable del nombre y al nuevo checkbox ----
      const vendorNameStrong = headerRow.querySelector("strong");
      const vendorCheckbox = headerRow.querySelector(".vendor-checkbox");

      // ---- Evento de Clic para Contraer/Expandir (ahora en el nombre) ----
      // Se asocia solo al nombre para no interferir con el checkbox
      vendorNameStrong.addEventListener('click', function () {
        const currentVendor = headerRow.dataset.vendor; // Obtenemos el vendor desde el data-attribute de la fila
        const invoiceRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${currentVendor}"]`);
        invoiceRows.forEach(row => {
          row.style.display = row.style.display === 'none' ? '' : 'none';
        });
      });

      // MODIFICACIÓN 2: Agregar Evento de Cambio al Checkbox de Cabecera ----
      vendorCheckbox.addEventListener('change', function (event) {
        const isChecked = event.target.checked; // Estado del checkbox de cabecera (true si está marcado)
        const currentVendor = event.target.dataset.vendor; // Vendor asociado a este checkbox

        // Seleccionar todos los checkboxes DENTRO de las filas de factura para este vendor
        const invoiceCheckboxes = document.querySelectorAll(`tr.invoice-row[data-vendor="${currentVendor}"] .row-checkbox`);

        // Iterar sobre los checkboxes de las facturas y establecer su estado 'checked'
        invoiceCheckboxes.forEach(checkbox => {
          checkbox.checked = isChecked;
          // Opcional: podrías querer disparar el evento 'change' en cada checkbox individual
          // si tienes otra lógica que depende de ello, aunque usualmente no es necesario
          // checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        console.log('vendor checkbox');
        updateVendorHeaderTotal(currentVendor);
        actualizarTotalSiNoHayCheckboxMarcado();
      });

      tableBody.appendChild(headerRow);

      // Agregar cada factura asociada al vendor
      for (const invoice of groupedInvoices[vendor].invoices) {
        const tr = document.createElement("tr");
        tr.classList.add("invoice-row");
        // Asignar el vendor para relacionarlas con la cabecera
        tr.dataset.vendor = invoice.vendor;
        tr.dataset.id = invoice.ID;
        tr.dataset.url = invoice.fileURL;
        tr.innerHTML = `
          <td>
            <input type="checkbox" class="row-checkbox" data-fileurl="${invoice.fileURL}" data-filetype="${invoice.fileType}">
          </td>
          <td>
            <a class="dragout" href='#'
              onclick="openDocument('${invoice.fileURL}')" 
              draggable="true"
              data-filename="${invoice.docName}" 
              data-filetype="${invoice.fileType}">
              <div data-field="fileType">
                ${invoice.fileType === 'application/pdf'
            ? '<img src="/Styles/pdf.svg" alt="Icono PDF">'
            : '<img src="/Styles/image.svg" alt="Icono imagen">'
          }
              </div>
            </a>
          </td>
          <td><div class="editable-cell" data-field="docName" contenteditable="true" style="${invoice.docName ? '' : 'background-color: #f8d7da;'}">${limitCellText(invoice.docName)}</div></td>
          <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true" style="${invoice.invoiceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceNumber}</div></td>
          <td class="hidden-column"><div class="editable-cell" data-field="vendor" contenteditable="true" style="${invoice.vendor ? '' : 'background-color: #f8d7da;'}">${invoice.vendor}</div></td>
          <td>
          <div class="editable-cell" data-field="referenceNumber" contenteditable="true" style="${invoice.referenceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.referenceNumber}</div></td>
          <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true" style="${invoice.invoiceTotal ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceTotal}</div></td>
          <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true" style="${invoice.invoiceDate ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceDate}</div></td>
          <td><div class="editable-cell" data-field="dueDate" contenteditable="true" style="${invoice.dueDate ? '' : 'background-color: #f8d7da;'}">${invoice.dueDate}</div></td>
          <td>
            <div style="text-align: center;">
              <!-- Se asigna un color por defecto (rojo) y luego se actualizará en función de la existencia de notas -->
              <div class="contenedor-icono">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16" style="cursor: pointer;" onclick='showNotesModal("${invoice.ID}", "${invoice.invoiceNumber}")'>
                  <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
                </svg>

              </div>
            </div>
          </td>
        `;


        // Manejo de edición de celdas
        let shouldFireChange = false;
        tr.addEventListener("input", function () {
          shouldFireChange = true;
        });
        tr.addEventListener("keydown", function (e) {
          if (e.key === 'Enter' && shouldFireChange) {
            shouldFireChange = false;
            const currentRow = this.closest('tr');
            const rowData = {};
            const cells = currentRow.querySelectorAll('.editable-cell[contenteditable="true"]');
            cells.forEach(cell => {
              const field = cell.dataset.field;
              const value = cell.textContent.trim();
              rowData[field] = value;
            });
            updateElement(currentRow.dataset.id, rowData);
          }
        });


        // Evento del checkbox para mostrar documento
        const checkbox = tr.querySelector('.row-checkbox');
        checkbox.addEventListener('change', function () {
          const isChecked = this.checked;
          if (isChecked) {
            showDocument(this.dataset.fileurl, this.dataset.filetype);
          }
          const currentVendor = this.closest('tr').dataset.vendor;
          updateVendorHeaderTotal(currentVendor);
          actualizarTotalSiNoHayCheckboxMarcado();
        });

        tableBody.appendChild(tr);
        // Consultar si la factura tiene notas y actualizar el color del ícono
        getNotes(invoice.ID)
          .then(notesContent => {
            const iconContainer = tr.querySelector('.contenedor-icono');
            if (notesContent && notesContent.trim() !== '') {
              // Si existen notas, se cambia el color (por ejemplo, a verde)
              iconContainer.classList.add("icon");
            }
          })
          .catch(error => {
            console.error("Error al obtener notas para la factura", invoice.ID, error);
          });
      }

      // Agregar fila con el total
      const totalRow = document.createElement("tr");
      totalRow.dataset.totalbyvendor = true;
      totalRow.classList.add("vendor-total");
      totalRow.dataset.vendor = vendor;
      totalRow.innerHTML = `
        <td colspan="4"></td>
        <td style="font-weight: bold; text-align: right;">Total:</td>
        <td style="font-weight: bold; text-align: left;"><div data-field="invoiceTotal">
          $${groupedInvoices[vendor].total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}
        </div>
        </td>
        <td></td>
        <td></td>
        <td></td>
      `;
      tableBody.appendChild(totalRow);

      const checkboxes = document.querySelectorAll('.row-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('click', handleCheckboxClick);
      });

      // Función para manejar el evento de clic en los checkboxes
      function handleCheckboxClick(event) {
        // Si la tecla Ctrl no está presionada
        if (!event.ctrlKey) {
          // Recorre todos los checkboxes y desmárcalos
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
          });
          // Marca solo el checkbox que fue clicado
          event.target.checked = true;
        }
        // Si la tecla Ctrl está presionada, permite la selección múltiple
      }

      function actualizarTotalSiNoHayCheckboxMarcado() {
        // Selecciona todas las filas de totales por vendedor
        const totalRows = document.querySelectorAll('tr[data-totalbyvendor="true"]');
        totalRows.forEach(row => {
          const vendor = row.dataset.vendor;
          // Busca si existe al menos un checkbox marcado en las filas de factura de ese vendor
          const checkboxMarcado = document.querySelector(`tr.invoice-row[data-vendor="${vendor}"] .row-checkbox:checked`);
          if (!checkboxMarcado) {
            // Si no hay ninguno marcado, se cambia el valor de la celda invoiceTotal
            const invoiceTotalDiv = row.querySelector('div[data-field="invoiceTotal"]');
            if (invoiceTotalDiv) {
              // Aquí puedes definir el nuevo valor que necesites; en este ejemplo se pone $0.00
              invoiceTotalDiv.textContent = "$" + groupedInvoices[vendor].total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            }
          }
        });
      }


      function updateVendorHeaderTotal(vendor) {
        let sum = 0;
        // Seleccionar todas las filas del proveedor especificado
        const vendorRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${vendor}"]`);


        vendorRows.forEach(row => {
          const checkbox = row.querySelector('.row-checkbox');
          // Verificar si el checkbox existe y está seleccionado
          if (checkbox && checkbox.checked) {
            const totalDiv = row.querySelector('div[data-field="invoiceTotal"]');
            if (totalDiv) {
              const text = totalDiv.textContent.trim();
              const cleanedText = text.replace(/[^0-9.-]+/g, ""); // Eliminar caracteres no numéricos
              const value = parseFloat(cleanedText);
              if (!isNaN(value)) {
                sum += value;
              } else {
                console.warn(`Valor no numérico encontrado: "${text}"`);
              }
            } else {
              console.warn("Div con data-field='invoiceTotal' no encontrado en la fila");
            }
          }
        });

        // Seleccionar la fila del total del proveedor
        const totalRow = document.querySelector(`tr[data-vendor="${vendor}"][data-totalbyvendor="true"]`);
        if (totalRow) {
          const totalCell = totalRow.querySelector('div[data-field="invoiceTotal"]');
          if (totalCell) {
            // Actualizar el contenido de la celda con el total formateado
            totalCell.textContent = `$${sum.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
          } else {
            console.warn("Div con data-field='invoiceTotal' no encontrado en la fila de total");
          }
        } else {
          console.warn(`Fila de total para el proveedor "${vendor}" no encontrada`);
        }
      }
    }
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