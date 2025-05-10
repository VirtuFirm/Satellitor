import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Lay from './Lay.jsx';
import Home from './Routes/Home/Home.jsx';
import Map from './Routes/Map/Map.jsx';
import Results from './Routes/Results/Results.jsx';
import NotFound from './Routes/NotFound/NotFound.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Lay />,
    children: [
      { index: true, element: <Home /> },
      { path: 'Map', element: <Map /> },
      { path: 'Results', element: <Results /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router}/>;
}

export default App;