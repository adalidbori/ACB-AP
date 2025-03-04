 // Editable table functionality
 let currentlyEditing = null;
 // Evento para manejar edición en celdas normales
 document.addEventListener('click', function(event) {
     const cell = event.target.closest('.editable-cell');
     if (!cell || cell.dataset.type === 'dropdown') return;

     if (currentlyEditing) {
         finishEditing(currentlyEditing);
     }
     startEditing(cell);
 });

 function startEditing(cell) {
     const value = cell.textContent;
     cell.classList.add('editing');
     cell.innerHTML = `<input type="text" value="${value}" class="form-control form-control-sm">`;

     const input = cell.querySelector('input');
     input.focus();
     input.setSelectionRange(0, input.value.length);

     input.addEventListener('blur', function() {
         finishEditing(cell);
     });

     input.addEventListener('keydown', function(e) {
         if (e.key === 'Enter') {
             finishEditing(cell);
         } else if (e.key === 'Escape') {
             cell.innerHTML = value;
             cell.classList.remove('editing');
             currentlyEditing = null;
         }
     });

     currentlyEditing = cell;
 }

 function finishEditing(cell) {
     const input = cell.querySelector('input');
     if (input) {
         cell.textContent = input.value;
     }
     cell.classList.remove('editing');
     currentlyEditing = null;
 }