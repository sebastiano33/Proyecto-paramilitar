const state = require('../store/state');

exports.getAnuncios = (req, res) => {
    const { lat, lon } = req.query;
    const ahora = Date.now();
    
    // Limpieza de destacados expirados
    state.anuncios.forEach(ad => { 
        if (ad.destacado && ad.expiraEn < ahora) ad.destacado = false; 
    });

    let filtered = state.anuncios;
    if (lat && lon) {
        const zona = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
        filtered = state.anuncios.filter(ad => ad.zona === zona);
    }
    
    res.json([...filtered].sort((a,b) => (b.destacado?1:0) - (a.destacado?1:0)));
};

exports.publicarAnuncio = (req, res) => {
    const { titulo, descripcion, latitud, longitud, userId } = req.body;
    const zona = `${Number(latitud).toFixed(2)}_${Number(longitud).toFixed(2)}`;
    
    const nuevo = { 
        id: `ad-${Date.now()}`, 
        userId, titulo, descripcion, 
        lat: latitud, lon: longitud, zona, 
        destacado: false, timestamp: Date.now(), 
        vistas: 0, clicks: 0 
    };
    
    state.anuncios.push(nuevo);
    res.status(201).json(nuevo);
};
