import React, { useContext, useState, useEffect } from "react";
import { UserContext } from "../context/user.context";
import axios from "../config/axios";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const { user } = useContext(UserContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Function to generate a consistent color based on project name
  const getProjectColor = (name) => {
    // Create a hash from the project name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate HSL color values
    const h = Math.abs(hash) % 360;
    const s = 70 + (Math.abs(hash) % 15); // 70-85% saturation
    const l = 85 + (Math.abs(hash) % 10); // 85-95% lightness (pastel)

    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  // Function to generate a darker version for borders/hover
  const getDarkerColor = (hslColor) => {
    const values = hslColor.match(/\d+/g);
    const h = values[0];
    const s = values[1];
    const l = Math.max(70, parseInt(values[2]) - 15); // Darken but keep it light
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  function createProject(e) {
    e.preventDefault();
    axios
      .post("/projects/create", {
        name: projectName,
      })
      .then((res) => {
        setProjects([...projects, res.data.project]);
        setIsModalOpen(false);
        setProjectName("");
      })
      .catch((error) => {
        console.log(error);
      });
  }

  useEffect(() => {
    setIsLoading(true);
    axios
      .get("/projects/all")
      .then((res) => {
        setProjects(res.data.projects);
        setIsLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setIsLoading(false);
      });
  }, []);

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Projects</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:shadow-lg"
        >
          <i className="ri-add-line"></i>
          New Project
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="bg-gray-100 rounded-xl p-6 h-40 animate-pulse"
            ></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-blue-100 p-6 rounded-full mb-4">
            <i className="ri-folder-open-line text-4xl text-blue-600"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            No projects yet
          </h2>
          <p className="text-gray-500 mb-6">
            Get started by creating your first project
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 h-40 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
          >
            <i className="ri-add-line text-3xl text-gray-400 group-hover:text-blue-500 mb-2"></i>
            <span className="text-gray-500 group-hover:text-blue-600">
              New Project
            </span>
          </div>

          {projects.map((project) => {
            const bgColor = getProjectColor(project.name);
            const borderColor = getDarkerColor(bgColor);

            return (
              <div
                key={project._id}
                onClick={() => navigate(`/project`, { state: { project } })}
                className="rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer h-40 flex flex-col justify-between"
                style={{
                  backgroundColor: bgColor,
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 2px 4px ${borderColor}20`,
                }}
              >
                <div>
                  <h2 className="font-semibold text-lg text-gray-800 line-clamp-1">
                    {project.name}
                  </h2>
                  <p className="text-sm text-gray-700 mt-1">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-full">
                    <i className="ri-user-line text-gray-600"></i>
                    <span className="text-sm text-gray-700">
                      {project.users.length}{" "}
                      {project.users.length === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <div className="bg-white/50 p-1 rounded-full">
                    <i className="ri-arrow-right-s-line text-gray-600"></i>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
          <div
            className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Create New Project
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setProjectName("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <form onSubmit={createProject}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  onChange={(e) => setProjectName(e.target.value)}
                  value={projectName}
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="My Awesome Project"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  onClick={() => {
                    setIsModalOpen(false);
                    setProjectName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={!projectName.trim()}
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Home;
