document.addEventListener('DOMContentLoaded', loadInvoices);
const tableBody = document.querySelector('tbody');
// Función para convertir un string en formato internacional a número
function parseInternationalCurrency(amountStr) {
  return parseFloat(amountStr) || 0;
}

function showNotesModal(invoiceId, invoiceNumber) {
  currentInvoiceId = invoiceId;
  const modalEl = document.getElementById('exampleModal');
  modalEl.querySelector('.modal-title').textContent = `Notes: ${invoiceNumber}`;

  // Petición para obtener la nota existente asociada al invoiceId
  fetch(`http://${window.miVariable}:3000/invoices/notes/${invoiceId}`)
    .then(response => response.json())
    .then(data => {
      // Suponiendo que 'data' es un arreglo de notas
      if (data.length > 0) {
        // Si existe alguna nota, la mostramos en el textarea
        modalEl.querySelector('#notes-text').value = data[0].content;
      } else {
        // Si no existe, dejamos el textarea vacío
        modalEl.querySelector('#notes-text').value = '';
      }
    })
    .catch(error => {
      console.error("Error al obtener las notas:", error);
      modalEl.querySelector('#notes-text').value = '';
    });

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('.modal-save-button');
  saveButton.onclick = () => {
    const notesContent = modalEl.querySelector('#notes-text').value;
    insertUpdateNotes(invoiceId, notesContent);
    // Cierra el modal
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  };

  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}




async function insertUpdateNotes(invoiceID, content) {
  const formattedContent = content.replace(/\r?\n/g, '\r\n');
  try {
    const response = await fetch(`http://${window.miVariable}:3000/notes-upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        invoiceID: invoiceID,
        content: formattedContent,
        userID: 1 //temporal value
      })
    });
    const serverResponse = await response.json();
    console.log("Respuesta del servidor:", serverResponse.text);
    return serverResponse.text;
  } catch (error) {
    console.error("Error en la inserción:", error);
    throw error;
  }
}

async function loadInvoices() {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/invoices/status/4`);
    const invoices = await response.json();
    tableBody.innerHTML = ""; // Limpiar contenido previo

    // Agrupar facturas por vendor y sumar los totales usando el formato internacional
    const groupedInvoices = invoices.reduce((groups, invoice) => {
      const vendor = invoice.vendor;
      if (!groups[vendor]) {
        groups[vendor] = { invoices: [], total: 0 };
      }
      groups[vendor].invoices.push(invoice);
      const amount = parseInternationalCurrency(invoice.invoiceTotal);
      groups[vendor].total += amount;
      return groups;
    }, {});

    // Recorrer cada grupo y agregar las filas en la tabla
    for (const vendor in groupedInvoices) {
      // Crear fila de cabecera para cada vendor
      const headerRow = document.createElement("tr");
      headerRow.classList.add("vendor-header");
      headerRow.dataset.vendor = vendor;
      headerRow.innerHTML = `
        <td colspan="9" style="background:#f0f0f0; cursor: pointer;">
          <strong>${vendor}</strong> - Total: $${groupedInvoices[vendor].total.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </td>`;
      
      // Agregar evento de clic para contraer/expandir
      headerRow.addEventListener('click', function() {
        // Seleccionar todas las filas de factura para este vendor
        const invoiceRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${vendor}"]`);
        invoiceRows.forEach(row => {
          // Alternar visibilidad: si está oculto, se muestra; si se muestra, se oculta
          row.style.display = row.style.display === 'none' ? '' : 'none';
        });
      });
      
      tableBody.appendChild(headerRow);

      // Agregar cada factura asociada al vendor
      groupedInvoices[vendor].invoices.forEach(invoice => {
        const tr = document.createElement("tr");
        tr.classList.add("invoice-row");
        // Asignar el vendor para relacionarlas con la cabecera
        tr.dataset.vendor = invoice.vendor;
        tr.dataset.id = invoice.ID;
        const aux = typeof invoice.invoiceNumber === 'string' ? invoice.invoiceNumber : String(invoice.invoiceNumber);

        tr.innerHTML = `
          <td>
            <input type="checkbox" class="row-checkbox" data-fileurl="${invoice.fileURL}" data-filetype="${invoice.fileType}">
          </td>
          <td>
            <a class="dragout" href='${invoice.fileURL}' 
              target="_blank" 
              rel="noopener noreferrer" 
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
          <td><div class="editable-cell" data-field="docName" contenteditable="true">${invoice.docName}</div></td>
          <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true">${invoice.invoiceNumber}</div></td>
          <td><div class="editable-cell" data-field="vendor" contenteditable="true">${invoice.vendor}</div></td>
          <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true">${invoice.invoiceTotal}</div></td>
          <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true">${invoice.invoiceDate}</div></td>
          <td><div class="editable-cell" data-field="dueDate" contenteditable="true">${invoice.dueDate}</div></td>
          <td>
            <div data-field="notes">
              <a href="#" data-toggle="modal" onclick='showNotesModal("${invoice.ID}", "${aux}")' data-target="#exampleModal" data-whatever="${invoice.ID}">Show</a>
            </div>
          </td>

        `;
        
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
            console.log(`Datos de la fila con ID ${currentRow.dataset.id}:`, rowData);
            updateElement(currentRow.dataset.id, rowData);
          }
        });

        // Añadir evento change al checkbox para verificar si está seleccionado
        const checkbox = tr.querySelector('.row-checkbox');
        checkbox.addEventListener('change', function () {
          const isChecked = this.checked;
          if (isChecked) {
            // Llamar a showDocument cuando el checkbox esté seleccionado
            showDocument(this.dataset.fileurl, this.dataset.filetype);
          }
        });
        tableBody.appendChild(tr);
      });
    }

    // Configurar evento dragstart para los enlaces
    document.querySelectorAll(".dragout").forEach(a => {
      a.addEventListener("dragstart", function(evt) {
        const mimeType = this.getAttribute('data-filetype') || 'application/octet-stream';
        const fileName = this.getAttribute('data-filename') || 'archivo';
        const fileUrl = this.href;
        const timestampName = fileUrl.split('/').pop();
        let localUrl = window.location.protocol + "//" + window.location.host + "/uploads/" + timestampName;
        evt.dataTransfer.setData("DownloadURL", `${mimeType}:${fileName}:${localUrl}`);
      }, false);
    });

  } catch (error) {
    console.error("Error al obtener los invoices:", error);
  }
}
