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

  const getProjectColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 80%, 90%)`;
  };

  const getDarkerColor = (hslColor) => {
    const values = hslColor.match(/\d+/g);
    const h = values[0];
    return `hsl(${h}, 70%, 80%)`;
  };

  function createProject(e) {
    e.preventDefault();
    axios
      .post("/projects/create", {
        name: projectName,
      })
      .then((res) => {
        const newProject = {
          ...res.data.project,
          createdAt: res.data.project.createdAt || new Date().toISOString(),
        };
        setProjects([...projects, newProject]);
        setIsModalOpen(false);
        setProjectName("");
      })
      .catch((error) => {
        console.log(error);
      });
  }

  function deleteProject(id) {
    if (window.confirm("Are you sure you want to delete this project?")) {
      axios
        .delete(`/projects/${id}`)
        .then(() => {
          setProjects(projects.filter((project) => project._id !== id));
        })
        .catch((error) => {
          console.log("Failed to delete project:", error);
          alert("Failed to delete project. Please try again.");
        });
    }
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
    <main className="min-h-screen p-6 max-w-7xl mx-auto bg-gradient-to-br from-purple-900 via-violet-900 to-fuchsia-900">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          My Projects
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30"
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
              className="bg-white/10 rounded-xl p-6 h-40 animate-pulse"
            ></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-white/20 p-6 rounded-full mb-4">
            <i className="ri-folder-open-line text-4xl text-purple-300"></i>
          </div>
          <h2 className="text-2xl font-semibold text-purple-100 mb-2">
            No projects yet
          </h2>
          <p className="text-purple-200/80 mb-6">
            Get started by creating your first project
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors shadow-md"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center justify-center border-2 border-dashed border-purple-300/50 rounded-xl p-6 h-40 cursor-pointer hover:border-purple-400 hover:bg-white/10 transition-all duration-200 group"
          >
            <i className="ri-add-line text-3xl text-purple-300/70 group-hover:text-purple-200 mb-2"></i>
            <span className="text-purple-200/80 group-hover:text-purple-100">
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
                className="rounded-xl p-6 hover:shadow-lg transition-all duration-300 cursor-pointer h-40 flex flex-col justify-between"
                style={{
                  backgroundColor: bgColor,
                  border: `1px solid ${borderColor}`,
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                }}
              >
                <div>
                  <h2 className="font-semibold text-lg text-gray-800 line-clamp-1">
                    {project.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2 bg-white/80 px-2 py-1 rounded-full backdrop-blur-sm">
                    <i className="ri-user-line text-gray-600"></i>
                    <span className="text-sm text-gray-700">
                      {project.users.length}{" "}
                      {project.users.length === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project._id);
                      }}
                      className="bg-white/80 p-1 rounded-full backdrop-blur-sm hover:bg-red-500/80 transition-colors"
                      title="Delete Project"
                    >
                      <i className="ri-delete-bin-line text-gray-600 hover:text-white"></i>
                    </button>
                    <div className="bg-white/80 p-1 rounded-full backdrop-blur-sm">
                      <i className="ri-arrow-right-s-line text-gray-600"></i>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div
            className="bg-gradient-to-br from-purple-900/90 to-violet-900/90 p-8 rounded-xl shadow-2xl w-full max-w-md border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
                Create New Project
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setProjectName("");
                }}
                className="text-purple-200 hover:text-white transition-colors"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <form onSubmit={createProject}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Project Name
                </label>
                <input
                  onChange={(e) => setProjectName(e.target.value)}
                  value={projectName}
                  type="text"
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-purple-50 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder-purple-200/50"
                  placeholder="My Awesome Project"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-5 py-2.5 text-purple-100 bg-white/10 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
                  onClick={() => {
                    setIsModalOpen(false);
                    setProjectName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50"
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