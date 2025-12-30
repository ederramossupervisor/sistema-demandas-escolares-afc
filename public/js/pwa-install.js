class PWAInstall {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });
  }
  
  showInstallButton() {
    if (!this.installButton) {
      this.installButton = document.createElement('button');
      this.installButton.className = 'btn btn-success btn-sm position-fixed';
      this.installButton.style.bottom = '20px';
      this.installButton.style.right = '20px';
      this.installButton.style.zIndex = '1000';
      this.installButton.innerHTML = '<i class="fas fa-download"></i> Instalar App';
      this.installButton.onclick = () => this.installApp();
      
      document.body.appendChild(this.installButton);
    }
  }
  
  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('Usuário aceitou a instalação');
      }
      
      this.deferredPrompt = null;
      this.installButton.remove();
    }
  }
}

// Inicializar quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstall();
});