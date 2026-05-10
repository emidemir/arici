import { Outlet } from 'react-router-dom'; // 1. Import Outlet
import 'leaflet/dist/leaflet.css';
import './assets/global.css';
import Navbar from './components/commons/Navbar'
// 2. You can remove the ExplorePage import here, as the router handles it now
// import ExplorePage from './pages/ExplorePage'; 

function App() {
  return (
      <div className="app-container">
        <Navbar />

        <main className="app-main">
          {/* 3. Add Outlet here! Now your pages will swap out based on the URL */}
          <Outlet /> 
        </main>
      </div>
  );
}

export default App;