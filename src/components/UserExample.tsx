import { useState } from "react";
import { useEntity } from "../hooks/useEntity";
import { userEntityConfig } from "../entities/User";

export const UserExample = () => {
  const { items: users, loading, create } = useEntity<any>(userEntityConfig);
  const [newUser, setNewUser] = useState<Record<string, any>>({});

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await create({
      ...newUser,
      isActive: "true",
    });
    setNewUser({});
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">User Management Example</h2>

      {/* Create User Form */}
      <form onSubmit={handleCreateUser} className="mb-8 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Create New User</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {Object.entries(userEntityConfig.properties).map(([key, def]) => {
            const inputType =
              def.type === "integer" || def.type === "number"
                ? "number"
                : "text";
            return (
              <input
                key={key}
                type={key.toLowerCase().includes("email") ? "email" : inputType}
                placeholder={key}
                value={newUser[key] ?? ""}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    [key]:
                      inputType === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
                className="px-3 py-2 border rounded-md"
                required={userEntityConfig.required?.includes(key)}
              />
            );
          })}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>

      {/* Users List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Users ({users.length})</h3>
        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500">No users found. Create one above!</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{user.name}</h4>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-sm text-gray-500">Age: {user.age}</p>
                  </div>
                  <div className="text-xs text-gray-400">ID: {user.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
