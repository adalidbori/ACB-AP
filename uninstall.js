var Service = require('node-windows').Service;

var svc = new Service({
    name: 'AccountPayable',
    description: 'ACB account payable app',
    script: './server.js'
  });

svc.on('uninstall', function(){
  console.log('El servicio se ha desinstalado.');
});

svc.uninstall();
