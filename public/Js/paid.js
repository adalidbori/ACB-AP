document.addEventListener('DOMContentLoaded', loadInvoices);
const tableBody = document.querySelector('tbody');
// Función para convertir un string en formato internacional a número
function parseInternationalCurrency(amountStr) {
  return parseFloat(amountStr) || 0;
}

async function showNotesModal(invoiceId, invoiceNumber) {
  currentInvoiceId = invoiceId;
  const modalEl = document.getElementById('exampleModal');
  modalEl.querySelector('.modal-title').textContent = `Notes: ${invoiceNumber}`;

  // Obtener las notas de forma asincrónica y asignarlas al textarea
  const notesContent = await getNotes(invoiceId);
  modalEl.querySelector('#notes-text').value = notesContent;

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('.modal-save-button');
  saveButton.onclick = async () => {
    const notesContent = modalEl.querySelector('#notes-text').value;
    await insertUpdateNotes(invoiceId, notesContent);
    // Cierra el modal
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  };

  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}



async function getNotes(invoiceId) {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/invoices/notes/${invoiceId}`);
    const data = await response.json();
    // Suponiendo que 'data' es un arreglo de notas
    if (data.length > 0) {
      // Si existe alguna nota, la retornamos
      return data[0].content;
    } else {
      // Si no existe, retornamos una cadena vacía
      return '';
    }
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    return '';
  }
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
      groupedInvoices[vendor].invoices.forEach(invoice =>  {
        const tr = document.createElement("tr");
        
        tr.classList.add("invoice-row");
        // Asignar el vendor para relacionarlas con la cabecera
        tr.dataset.vendor = invoice.vendor;
        tr.dataset.id = invoice.ID;

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
      <div style="text-align: center;">
        <div class="contenedor-icono" style="color: red;">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" 
              class="bi bi-box-arrow-up-right" viewBox="0 0 16 16" style="cursor: pointer;"
              onclick='showNotesModal("${invoice.ID}", "${invoice.invoiceNumber}")'>
            <path fill-rule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5"/>
            <path fill-rule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z"/>
          </svg>
        </div>
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

        // Después de agregar la fila a la tabla:
        tr.querySelectorAll('.editable-cell').forEach(cell => {
          cell.style.fontSize = '12px';
          cell.style.whiteSpace = 'nowrap';
          cell.style.overflow = 'hidden';
          cell.style.textOverflow = 'ellipsis';
        });

        // Si quieres aplicar estilos a toda la fila:
        tr.style.height = '15px';


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
