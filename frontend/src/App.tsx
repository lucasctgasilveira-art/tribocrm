import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Routes>
        <Route
          path="/"
          element={
            <div className="flex items-center justify-center min-h-screen">
              <h1 className="text-4xl font-normal">
                Tribo<span className="text-accent font-extrabold">CRM</span>
              </h1>
            </div>
          }
        />
      </Routes>
    </div>
  )
}
