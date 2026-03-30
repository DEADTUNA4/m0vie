const OMDb_API_KEY = 'b8a060b5';

// --- DATA MANAGEMENT ---
async function fetchLocalData() {
    try {
        // Fetch from local JSON files with cache-busting timestamp
        const ts = Date.now();
        const [moviesRes, seriesRes] = await Promise.all([
            fetch(`movies.json?t=${ts}`).then(r => r.ok ? r.json() : []),
            fetch(`series.json?t=${ts}`).then(r => r.ok ? r.json() : [])
        ]);
        
        return {
            movies: moviesRes,
            series: seriesRes
        };
    } catch (err) {
        console.error('Error fetching data:', err);
        return { movies: [], series: [] };
    }
}

// --- HOME PAGE LOGIC ---
let allData = { movies: [], series: [] };
let heroInterval = null;

async function loadContent() {
    allData = await fetchLocalData();
    renderGrids(allData.movies, allData.series);
    setupSearch();
    startHeroRotation();
}

function startHeroRotation() {
    const combined = [...allData.movies, ...allData.series];
    if (combined.length === 0) return;

    // Initial rotation
    rotateHero(combined);

    // Set interval for every 5 seconds
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        rotateHero(combined);
    }, 5000);
}

function rotateHero(items) {
    const heroBg = document.getElementById('hero-bg');
    const heroTitle = document.getElementById('hero-title');
    const heroDesc = document.getElementById('hero-desc');
    const heroPlayLink = document.getElementById('hero-play-link');
    const heroContent = document.getElementById('hero-content');

    if (!heroBg || !heroTitle) return;

    // Pick random item
    const item = items[Math.floor(Math.random() * items.length)];

    // Fade out content
    heroContent.style.opacity = '0';

    setTimeout(async () => {
        // Update content
        heroTitle.innerText = item.title;
        heroPlayLink.href = `player.html?id=${item.imdbID}`;
        
        // Use high-quality poster for background
        const highResPoster = item.poster.replace('_V1_SX300.jpg', '_V1_.jpg');
        heroBg.style.backgroundImage = `url('${highResPoster}')`;

        // Fetch plot if possible (limited to avoid API spam, but 1 fetch per 5s is usually okay for short sessions)
        try {
            const res = await fetch(`https://www.omdbapi.com/?i=${item.imdbID}&apikey=${OMDb_API_KEY}`);
            const data = await res.json();
            heroDesc.innerText = data.Plot !== 'N/A' ? data.Plot : `${item.title} (${item.year})`;
        } catch (e) {
            heroDesc.innerText = `${item.title} (${item.year})`;
        }

        // Fade in content
        heroContent.style.opacity = '1';
    }, 500);
}

function renderGrids(movies, series) {
    const movieGrid = document.getElementById('movies-grid');
    const seriesGrid = document.getElementById('series-grid');

    if (movieGrid) {
        movieGrid.innerHTML = movies.length > 0 
            ? movies.map(item => createCard(item)).join('')
            : '<p class="text-gray-500 col-span-full py-10 text-center text-lg italic">No movies found...</p>';
    }
    if (seriesGrid) {
        seriesGrid.innerHTML = series.length > 0
            ? series.map(item => createCard(item)).join('')
            : '<p class="text-gray-500 col-span-full py-10 text-center text-lg italic">No series found...</p>';
    }
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        
        const filteredMovies = allData.movies.filter(m => 
            m.title.toLowerCase().includes(term)
        );
        const filteredSeries = allData.series.filter(s => 
            s.title.toLowerCase().includes(term)
        );

        renderGrids(filteredMovies, filteredSeries);
    });
}

function createCard(item) {
    return `
        <a href="player.html?id=${item.imdbID}" class="movie-card block relative rounded-lg overflow-hidden bg-gray-900 shadow-xl group">
            <img src="${item.poster}" alt="${item.title}" class="w-full aspect-[2/3] object-cover">
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex flex-col justify-end p-4">
                <div class="opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
                    <h4 class="font-bold text-sm leading-tight">${item.title}</h4>
                    <p class="text-xs text-gray-400 mt-1">${item.year}</p>
                    <div class="mt-3 flex space-x-2">
                        <button class="bg-white text-black rounded-full p-2 hover:bg-gray-200 transition">
                            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </a>
    `;
}

// --- PLAYER PAGE LOGIC ---
let currentMedia = null;
let currentServer = 1;

async function initPlayer() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return window.location.href = 'index.html';

    try {
        const res = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${OMDb_API_KEY}`);
        currentMedia = await res.json();
        
        if (currentMedia.Response === 'False') throw new Error(currentMedia.Error);

        document.title = `mO movies - Watching ${currentMedia.Title}`;
        document.getElementById('media-title').innerText = currentMedia.Title;
        document.getElementById('media-year').innerText = currentMedia.Year;
        document.getElementById('media-plot').innerText = currentMedia.Plot;
        document.getElementById('media-genre').innerText = currentMedia.Genre;
        document.getElementById('media-director').innerText = currentMedia.Director;
        document.getElementById('media-actors').innerText = currentMedia.Actors;

        if (currentMedia.Type === 'series') {
            setupSeriesControls();
        }

        updateIframe();
    } catch (err) {
        console.error('Player error:', err);
        alert('Error loading media. Please try again.');
    }
}

function updateIframe() {
    const iframe = document.getElementById('video-iframe');
    const loader = document.getElementById('loading-overlay');
    const id = currentMedia.imdbID;
    
    loader.classList.remove('hidden');
    
    let url = '';
    const season = document.getElementById('season-select')?.value || 1;
    const episode = document.getElementById('episode-select')?.value || 1;

    if (currentServer === 1) {
        url = currentMedia.Type === 'movie' 
            ? `https://vidsrc.to/embed/movie/${id}` 
            : `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    } else if (currentServer === 2) {
        url = currentMedia.Type === 'movie'
            ? `https://multiembed.mov/?video_id=${id}`
            : `https://multiembed.mov/?video_id=${id}&s=${season}&e=${episode}`;
    } else {
        url = currentMedia.Type === 'movie'
            ? `https://vidsrc.xyz/embed/movie/${id}`
            : `https://vidsrc.xyz/embed/tv/${id}/${season}/${episode}`;
    }

    iframe.src = url;
    iframe.onload = () => loader.classList.add('hidden');
}

function changeServer(num) {
    currentServer = num;
    document.querySelectorAll('.server-btn').forEach((btn, idx) => {
        if (idx + 1 === num) {
            btn.classList.add('bg-red-600');
            btn.classList.remove('bg-gray-800');
        } else {
            btn.classList.add('bg-gray-800');
            btn.classList.remove('bg-red-600');
        }
    });
    updateIframe();
}

async function setupSeriesControls() {
    const controls = document.getElementById('series-controls');
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    
    controls.classList.remove('hidden');

    const totalSeasons = parseInt(currentMedia.totalSeasons) || 1;
    
    seasonSelect.innerHTML = '';
    for (let i = 1; i <= totalSeasons; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Season ${i}`;
        seasonSelect.appendChild(opt);
    }

    await loadEpisodes(1);

    seasonSelect.onchange = (e) => loadEpisodes(e.target.value);
    episodeSelect.onchange = () => updateIframe();
}

async function loadEpisodes(season) {
    const episodeSelect = document.getElementById('episode-select');
    episodeSelect.innerHTML = '<option>Loading...</option>';
    
    try {
        const res = await fetch(`https://www.omdbapi.com/?i=${currentMedia.imdbID}&Season=${season}&apikey=${OMDb_API_KEY}`);
        const data = await res.json();
        
        episodeSelect.innerHTML = '';
        if (data.Episodes) {
            data.Episodes.forEach(ep => {
                const opt = document.createElement('option');
                opt.value = ep.Episode;
                opt.innerText = `Ep ${ep.Episode}: ${ep.Title}`;
                episodeSelect.appendChild(opt);
            });
        } else {
            for (let i = 1; i <= 24; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.innerText = `Episode ${i}`;
                episodeSelect.appendChild(opt);
            }
        }
        updateIframe();
    } catch (err) {
        console.error('Error loading episodes:', err);
    }
}

// --- ADMIN DASHBOARD LOGIC ---
const ADMIN_PASS = '323cbc';
let fetchedItem = null;

function checkAdminAuth() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === ADMIN_PASS) {
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        sessionStorage.setItem('mO_admin_authed', 'true');
        updateAdminStats();
        renderManageTable();
    } else {
        alert('Incorrect Password');
    }
}

function initAdmin() {
    if (sessionStorage.getItem('mO_admin_authed') === 'true') {
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('admin-content').classList.remove('hidden');
        updateAdminStats();
        renderManageTable();
    }
}

function logoutAdmin() {
    sessionStorage.removeItem('mO_admin_authed');
    window.location.reload();
}

async function fetchFromOMDb() {
    const id = document.getElementById('imdb-id-input').value.trim();
    if (!id.startsWith('tt')) return alert('Please enter a valid IMDb ID (starting with tt)');

    const btnText = document.getElementById('fetch-btn-text');
    const spinner = document.getElementById('fetch-spinner');
    const preview = document.getElementById('preview-area');

    btnText.innerText = 'Fetching...';
    spinner.classList.remove('hidden');
    preview.classList.add('hidden');

    try {
        const res = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=${OMDb_API_KEY}`);
        const data = await res.json();

        if (data.Response === 'False') throw new Error(data.Error);

        fetchedItem = {
            imdbID: data.imdbID,
            title: data.Title,
            year: data.Year,
            poster: data.Poster !== 'N/A' ? data.Poster : 'https://via.placeholder.com/300x450?text=No+Poster',
            type: data.Type === 'series' ? 'series' : 'movie'
        };

        document.getElementById('preview-poster').src = fetchedItem.poster;
        document.getElementById('preview-title').innerText = fetchedItem.title;
        document.getElementById('preview-year').innerText = fetchedItem.year;
        document.getElementById('preview-type').innerText = fetchedItem.type;
        
        preview.classList.remove('hidden');
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btnText.innerText = 'Fetch Info';
        spinner.classList.add('hidden');
    }
}

async function saveContent() {
    if (!fetchedItem) return;

    const filename = fetchedItem.type === 'series' ? 'series.json' : 'movies.json';
    const data = await fetchLocalData();
    const currentList = fetchedItem.type === 'series' ? data.series : data.movies;
    
    if (currentList.some(item => item.imdbID === fetchedItem.imdbID)) {
        alert('Item already in library!');
        return;
    }

    currentList.push(fetchedItem);

    // Only try to save to disk if running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, data: currentList })
            });
            
            if (res.ok) {
                alert(`Successfully saved to ${filename}! Now commit to GitHub to update the live site.`);
                updateAdminStats();
                renderManageTable();
            } else {
                throw new Error('Local server failed to save');
            }
        } catch (err) {
            alert('Error: Make sure the local Python server is running (python server.py)');
        }
    } else {
        alert('Saving is only possible when running locally on your computer.');
    }
}

async function updateAdminStats() {
    const data = await fetchLocalData();
    document.getElementById('stat-movies').innerText = data.movies.length;
    document.getElementById('stat-series').innerText = data.series.length;
}

async function renderManageTable() {
    const data = await fetchLocalData();
    const tableBody = document.getElementById('manage-table-body');
    const allItems = [...data.movies, ...data.series];
    
    tableBody.innerHTML = allItems.map(item => `
        <tr class="border-b border-gray-800 text-sm hover:bg-gray-900 transition">
            <td class="py-3"><img src="${item.poster}" class="w-10 h-14 object-cover rounded"></td>
            <td class="py-3 font-medium">${item.title}</td>
            <td class="py-3 uppercase text-[10px] font-bold text-gray-500">${item.type}</td>
            <td class="py-3 text-gray-500">${item.imdbID}</td>
            <td class="py-3 text-right">
                <button onclick="removeItem('${item.imdbID}', '${item.type}')" class="text-red-600 hover:underline">Remove</button>
            </td>
        </tr>
    `).join('');
}

async function removeItem(id, type) {
    if (!confirm('Are you sure you want to remove this?')) return;
    
    const filename = type === 'series' ? 'series.json' : 'movies.json';
    const data = await fetchLocalData();
    let currentList = type === 'series' ? data.series : data.movies;
    currentList = currentList.filter(item => item.imdbID !== id);

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
            const res = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, data: currentList })
            });
            if (res.ok) {
                updateAdminStats();
                renderManageTable();
            }
        } catch (err) {
            alert('Error: Make sure the local Python server is running (python server.py)');
        }
    } else {
        alert('Removing is only possible when running locally on your computer.');
    }
}

function clearLibrary() {
    alert('Clear Library is disabled in this mode. Please remove items individually.');
}

// --- NETLIFY IDENTITY LOGIC ---
if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => {
        updateAuthUI(user);
    });

    window.netlifyIdentity.on("login", user => {
        updateAuthUI(user);
        window.netlifyIdentity.close();
    });

    window.netlifyIdentity.on("logout", () => {
        updateAuthUI(null);
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = 'index.html';
        }
    });
}

function updateAuthUI(user) {
    const authContainer = document.getElementById('auth-container');
    const adminLink = document.getElementById('admin-link');
    
    if (user) {
        // User is logged in
        if (authContainer) {
            authContainer.innerHTML = `
                <span class="text-xs text-gray-400 mr-2 hidden md:inline">Hi, ${user.user_metadata.full_name || user.email}</span>
                <button onclick="window.netlifyIdentity.logout()" class="text-gray-400 hover:text-white text-sm font-medium transition">Logout</button>
            `;
        }
        
        // Show Admin link if user has 'admin' role
        if (user.app_metadata && user.app_metadata.roles && user.app_metadata.roles.includes('admin')) {
            if (adminLink) adminLink.classList.remove('hidden');
        } else {
            if (adminLink) adminLink.classList.add('hidden');
        }
    } else {
        // User is logged out
        if (authContainer) {
            authContainer.innerHTML = `
                <button onclick="window.netlifyIdentity.open('login')" class="text-gray-300 hover:text-white px-2 py-1.5 rounded text-sm font-medium transition">Sign In</button>
                <button onclick="window.netlifyIdentity.open('signup')" class="bg-red-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-red-700 transition shadow-lg">Sign Up</button>
            `;
        }
        if (adminLink) adminLink.classList.add('hidden');
    }
}
