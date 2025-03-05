document.addEventListener('DOMContentLoaded', loadInvoices);
const tableBody = document.querySelector('tbody');
async function loadInvoices() {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/invoices/status/3`);
    const invoices = await response.json(); // Suponemos que invoices es un arreglo de objetos
    tableBody.innerHTML = ""; // Limpiar contenido previo

    invoices.forEach(invoice => {
      const tr = document.createElement("tr");
      tr.dataset.id = invoice.ID
      tr.innerHTML = `
          <td>
            <input type="checkbox" class="row-checkbox">
          </td>
          <td>
            <a id="dragout" href='${invoice.fileURL}' 
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
            <div data-field="deadline">
              <a href="#" onclick="showDocument('${invoice.fileURL}', '${invoice.fileType}'); return false;">Show</a>
            </div>
          </td>
        `;
      let shouldFireChange = false;
      tr.addEventListener("input", function () {
        shouldFireChange = true;

      });
      tr.addEventListener("keydown", function (e) {
        if (e.key === 'Enter') {
          if (shouldFireChange) {
            shouldFireChange = false;
            const currentRow = this.closest('tr');
            const rowData = {};
            const cells = currentRow.querySelectorAll('.editable-cell[contenteditable="true"]');
            cells.forEach(cell => {
              const field = cell.dataset.field; // Obtener el nombre del campo desde data-field
              const value = cell.textContent.trim(); // Obtener el contenido de la celda
              rowData[field] = value; // Asignar al objeto
            });
            console.log(`Datos de la fila con ID ${currentRow.dataset.id}:`, rowData);
            updateElement(currentRow.dataset.id, rowData);
          }
        }
      });
      tableBody.appendChild(tr);
    });

    document.getElementById("dragout").addEventListener("dragstart", function(evt) {
      // Definimos el tipo MIME del archivo PDF.
      const mimeType = this.getAttribute('data-filetype') || 'application/octet-stream';
      // Definimos el nombre con el que se descargará el archivo.
      const fileName = this.getAttribute('data-filename') || 'archivo';
      // Construimos la URL absoluta del archivo.
      
      const fileUrl = this.href;
      const timestampName = fileUrl.split('/').pop();
      let localUrl = window.location.protocol + "//" + window.location.host + "/uploads/"+timestampName;
      // Establecemos los datos del arrastre en el formato: [mime-type]:[nombre del archivo]:[URL]
      evt.dataTransfer.setData("DownloadURL", `${mimeType}:${fileName}:${localUrl}`);
    }, false);

  } catch (error) {
    console.error("Error al obtener los invoices:", error);
  }
}