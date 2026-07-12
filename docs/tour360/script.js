document.addEventListener('DOMContentLoaded', () => {

  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();

      navLinks.forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });

  const ctaButton = document.querySelector('.cta-button');

  if (ctaButton) {
    ctaButton.addEventListener('click', () => {
      const gallery = document.getElementById('portfolio-gallery');
      if (gallery) {
        gallery.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      navLinks.forEach((item) => item.classList.remove('active'));
      const portfolioLink = document.querySelector('.nav-link[href="#portfolio"]');
      if (portfolioLink) {
        portfolioLink.classList.add('active');
      }
    });
  }

  // Observação: a troca do panorama 360° ao clicar nos cards é controlada
  // pelo panorama3d.js (que também cuida do crossfade entre as imagens).
  // Aqui só registramos o clique para fins de log/depuração.
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  portfolioCards.forEach((card) => {
    card.addEventListener('click', () => {
      const label = card.querySelector('.card-label');
      const title = label ? label.textContent : 'Portfólio';
      console.log(`Card selecionado: ${title}`);
    });
  });

});