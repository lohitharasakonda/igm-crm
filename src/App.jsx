import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Calendar,
  Phone,
  Mail,
  ArrowLeft,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  FileDown
} from "lucide-react";

// =========================
// IndexedDB Setup (native)
// =========================
const DB_NAME = "FieldCRM";
const DB_VERSION = 1;

let db;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const upgradedDB = event.target.result;

      if (!upgradedDB.objectStoreNames.contains("clients")) {
        const clientStore = upgradedDB.createObjectStore("clients", {
          keyPath: "id",
          autoIncrement: true
        });
        clientStore.createIndex("name", "name", { unique: false });
      }

      if (!upgradedDB.objectStoreNames.contains("visits")) {
        const visitStore = upgradedDB.createObjectStore("visits", {
          keyPath: "id",
          autoIncrement: true
        });
        visitStore.createIndex("clientId", "clientId", { unique: false });
        visitStore.createIndex("date", "date", { unique: false });
      }
    };
  });
};

// =========================
// DB Operations
// =========================
const dbOps = {
  addClient: (client) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["clients"], "readwrite");
      const store = transaction.objectStore("clients");
      const request = store.add(client);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getAllClients: () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["clients"], "readonly");
      const store = transaction.objectStore("clients");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getClient: (id) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["clients"], "readonly");
      const store = transaction.objectStore("clients");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  updateClient: (client) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["clients"], "readwrite");
      const store = transaction.objectStore("clients");
      const request = store.put(client);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  addVisit: (visit) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["visits"], "readwrite");
      const store = transaction.objectStore("visits");
      const request = store.add(visit);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getVisitsByClient: (clientId) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["visits"], "readonly");
      const store = transaction.objectStore("visits");
      const index = store.index("clientId");
      const request = index.getAll(clientId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getAllVisits: () => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["visits"], "readonly");
      const store = transaction.objectStore("visits");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  updateVisit: (visit) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["visits"], "readwrite");
      const store = transaction.objectStore("visits");
      const request = store.put(visit);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
};

// =========================
// Utilities
// =========================
const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const getFollowUpStatus = (date) => {
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const followUp = new Date(date);
  followUp.setHours(0, 0, 0, 0);

  const diff = Math.floor((followUp - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "upcoming";
  return null;
};

// =========================
// Calendar Export (.ics)
// =========================
const exportToCalendar = (client, visit) => {
  const startDate = new Date(visit.followUpDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatICSDate = (date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Field CRM//EN",
    "BEGIN:VEVENT",
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:Follow up: ${client.name}`,
    `DESCRIPTION:Next Action: ${visit.nextAction || "Follow up"}\\n\\nLast Meeting: ${visit.note || ""}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `followup-${client.name.replace(/\s/g, "-")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

// =========================
// Main App
// =========================
export default function FieldCRM() {
  const [currentView, setCurrentView] = useState("home");
  const [clients, setClients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initDB().then(() => {
      loadData();
    });
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    const clientsData = await dbOps.getAllClients();
    const visitsData = await dbOps.getAllVisits();

    const enrichedClients = clientsData.map((client) => {
      const clientVisits = visitsData.filter((v) => v.clientId === client.id);
      const sortedVisits = clientVisits.sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastVisit = sortedVisits[0];

      return {
        ...client,
        lastVisitDate: lastVisit?.date,
        lastVisitSummary: lastVisit?.note,
        openFollowUps: clientVisits.filter((v) => v.followUpDate && !v.completed).length
      };
    });

    setClients(enrichedClients);
    setVisits(visitsData);
    setIsLoading(false);
  };

  // =========================
  // Import Clients (CSV)
  // =========================
  const handleImportClients = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split("\n").filter((line) => line.trim());

      const delimiter = text.includes("\t") ? "\t" : ",";

      const rows = lines.map((line) => {
        const result = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }

        result.push(current.trim());
        return result;
      });

      const headers = rows[0].map((h) => h.toLowerCase().trim());
      let imported = 0;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length < 2 || !rows[i][0]) continue;

        const clientRow = {};
        headers.forEach((header, idx) => {
          clientRow[header] = rows[i][idx]?.trim().replace(/^"|"$/g, "") || "";
        });

        await dbOps.addClient({
          name: clientRow.client || clientRow.name || "",
          city: clientRow.city || "",
          state: clientRow.state || "",
          contact: clientRow.contact || "",
          phone: clientRow.phone || "",
          email: clientRow.email || "",
          segment: clientRow.segment || "",
          status: clientRow.status || "Active",
          notes: clientRow.notes || ""
        });

        imported++;
      }

      await loadData();
      alert(`${imported} clients imported successfully!`);
    };

    reader.readAsText(file);
  };

  // =========================
  // Import Visits (CSV)
  // =========================
  const handleImportVisits = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split("\n").filter((line) => line.trim());

      const delimiter = text.includes("\t") ? "\t" : ",";

      const rows = lines.map((line) => {
        const result = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }

        result.push(current.trim());
        return result;
      });

      const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));
      let imported = 0;
      let skipped = 0;

      for (let i = 1; i < rows.length; i++) {
        if (rows[i].length < 2 || !rows[i][0] || !rows[i][1]) {
          skipped++;
          continue;
        }

        const visitRow = {};
        headers.forEach((header, idx) => {
          visitRow[header] = rows[i][idx]?.trim().replace(/^"|"$/g, "") || "";
        });

        const clientName = visitRow.client || visitRow.name || visitRow.clientname;
        if (!clientName) {
          skipped++;
          continue;
        }

        // IMPORTANT: use latest clients from state
        const match = clients.find(
          (c) => c.name.toLowerCase().trim() === clientName.toLowerCase().trim()
        );

        if (!match) {
          skipped++;
          continue;
        }

        // Date parsing
        let visitDate = visitRow.date;
        if (visitDate) {
          const parts = visitDate.split("/");
          if (parts.length === 3) {
            const month = parts[0].padStart(2, "0");
            const day = parts[1].padStart(2, "0");
            const year = parts[2];
            visitDate = `${year}-${month}-${day}`;
          }
        } else {
          visitDate = new Date().toISOString().split("T")[0];
        }

        // Follow-up parsing
        let followUpDate = visitRow.followupdate || visitRow.followup;
        if (followUpDate) {
          const parts = followUpDate.split("/");
          if (parts.length === 3) {
            const month = parts[0].padStart(2, "0");
            const day = parts[1].padStart(2, "0");
            const year = parts[2];
            followUpDate = `${year}-${month}-${day}`;
          }
        } else {
          followUpDate = null;
        }

        await dbOps.addVisit({
          clientId: match.id,
          date: visitDate,
          touchType: visitRow.touchtype || visitRow.type || "Call",
          outcome: visitRow.outcome || "",
          products: visitRow.products || visitRow.product || "",
          signal: visitRow.signal || "",
          note: visitRow.nextaction || visitRow.outcome || "",
          nextAction: visitRow.nextaction || "",
          followUpDate: followUpDate,
          priority: visitRow.priority || "medium",
          completed: followUpDate ? false : true
        });

        imported++;
      }

      await loadData();
      alert(
        `${imported} visits imported successfully!` +
          (skipped > 0 ? `\n${skipped} rows skipped (no matching client)` : "")
      );
    };

    reader.readAsText(file);
  };

  // =========================
  // Home View
  // =========================
  const HomeView = () => {
    const followUps = visits.filter((v) => v.followUpDate && !v.completed);

    const overdue = followUps.filter((v) => getFollowUpStatus(v.followUpDate) === "overdue");
    const today = followUps.filter((v) => getFollowUpStatus(v.followUpDate) === "today");
    const upcoming = followUps.filter((v) => getFollowUpStatus(v.followUpDate) === "upcoming");

    const FollowUpCard = ({ visit, status }) => {
      const client = clients.find((c) => c.id === visit.clientId);
      if (!client) return null;

      const statusColors = {
        overdue: "border-red-500 bg-red-50",
        today: "border-yellow-500 bg-yellow-50",
        upcoming: "border-green-500 bg-green-50"
      };

      return (
        <div
          className={`border-l-4 ${statusColors[status]} p-4 mb-3 rounded cursor-pointer hover:shadow-md transition-shadow`}
          onClick={() => {
            setSelectedClient(client);
            setCurrentView("clientDetail");
          }}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">{client.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{visit.nextAction}</p>
              <p className="text-xs text-gray-500 mt-2">{formatDate(visit.followUpDate)}</p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const updatedVisit = { ...visit, completed: true };
                dbOps.updateVisit(updatedVisit).then(() => loadData());
              }}
              className="text-green-600 hover:text-green-800"
              title="Mark done"
            >
              <CheckCircle size={20} />
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="pt-4">
        <h1 className="text-2xl font-bold mb-6">Follow-ups</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {overdue.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-red-600" size={20} />
                <h2 className="text-lg font-semibold text-red-600">Overdue ({overdue.length})</h2>
              </div>
              {overdue.map((v) => (
                <FollowUpCard key={v.id} visit={v} status="overdue" />
              ))}
            </div>
          )}

          {today.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="text-yellow-600" size={20} />
                <h2 className="text-lg font-semibold text-yellow-600">Today ({today.length})</h2>
              </div>
              {today.map((v) => (
                <FollowUpCard key={v.id} visit={v} status="today" />
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="text-green-600" size={20} />
                <h2 className="text-lg font-semibold text-green-600">Next 7 Days ({upcoming.length})</h2>
              </div>
              {upcoming.map((v) => (
                <FollowUpCard key={v.id} visit={v} status="upcoming" />
              ))}
            </div>
          )}
        </div>

        {followUps.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>No follow-ups scheduled</p>
          </div>
        )}
      </div>
    );
  };

  // =========================
  // Clients View
  // =========================
  const ClientsView = () => {
    const filteredClients = clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.city?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (!a.lastVisitDate) return 1;
        if (!b.lastVisitDate) return -1;
        return new Date(b.lastVisitDate) - new Date(a.lastVisitDate);
      });

    return (
      <div className="pt-4">
        <h1 className="text-2xl font-bold mb-4">Clients</h1>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mb-4 flex gap-2 flex-wrap">
          <label className="flex-1 min-w-[140px] cursor-pointer">
            <input type="file" accept=".csv" onChange={handleImportClients} className="hidden" />
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              <Upload size={18} />
              <span className="text-sm">Import Clients</span>
            </div>
          </label>

          <label className="flex-1 min-w-[140px] cursor-pointer">
            <input type="file" accept=".csv" onChange={handleImportVisits} className="hidden" />
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
              <Upload size={18} />
              <span className="text-sm">Import Visits</span>
            </div>
          </label>
        </div>

        <p className="text-xs text-gray-500 mb-4 px-1">
          💡 Tip: Export sheets as CSV. Clients: Client, City, State, Contact, Phone, Email, Segment, Status, Notes | Visits:
          Date, Client, Contact, Touch Type, Outcome, Products, Signal, Next Action, Follow-up Date, Priority
        </p>

        {/* Responsive grid that auto-adapts */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => {
                setSelectedClient(client);
                setCurrentView("clientDetail");
              }}
              className="bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">{client.name}</h3>
                  <p className="text-sm text-gray-600 truncate">
                    {client.city}, {client.state}
                  </p>

                  {client.lastVisitDate && (
                    <p className="text-xs text-gray-500 mt-2">Last visit: {formatDate(client.lastVisitDate)}</p>
                  )}
                </div>

                {client.openFollowUps > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                    {client.openFollowUps} pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No clients found</p>
            <p className="text-sm mt-2">Import your CSV to get started</p>
          </div>
        )}
      </div>
    );
  };

  // =========================
  // Client Detail View (responsive split)
  // =========================
  const ClientDetailView = () => {
    const [clientVisits, setClientVisits] = useState([]);

    useEffect(() => {
      if (!selectedClient) return;

      dbOps.getVisitsByClient(selectedClient.id).then((v) => {
        const sorted = v.sort((a, b) => new Date(b.date) - new Date(a.date));
        setClientVisits(sorted);
      });
    }, [selectedClient]);

    if (!selectedClient) return null;

    const lastVisit = clientVisits[0];
    const openFollowUps = clientVisits.filter((v) => v.followUpDate && !v.completed);

    return (
      <div className="pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] lg:gap-6">
          {/* LEFT column */}
          <aside className="lg:sticky lg:top-4">
            <div className="bg-blue-600 text-white p-4 -mx-4 lg:mx-0 rounded-none lg:rounded-xl">
              <button onClick={() => setCurrentView("clients")} className="mb-4">
                <ArrowLeft size={24} />
              </button>

              <h1 className="text-2xl font-bold">{selectedClient.name}</h1>
              <p className="text-blue-100">
                {selectedClient.city}, {selectedClient.state}
              </p>

              <div className="flex gap-3 mt-4 flex-wrap">
                {selectedClient.phone && (
                  <a
                    href={`tel:${selectedClient.phone}`}
                    className="flex items-center gap-2 bg-blue-500 px-4 py-2 rounded-lg"
                  >
                    <Phone size={16} />
                    <span className="text-sm">Call</span>
                  </a>
                )}

                {selectedClient.email && (
                  <a
                    href={`mailto:${selectedClient.email}`}
                    className="flex items-center gap-2 bg-blue-500 px-4 py-2 rounded-lg"
                  >
                    <Mail size={16} />
                    <span className="text-sm">Email</span>
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentView("addVisit")}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mt-4 flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Log Visit
            </button>
          </aside>

          {/* RIGHT column */}
          <main className="pt-4 lg:pt-0">
            {lastVisit && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h2 className="font-semibold text-blue-900 mb-2">Last Meeting</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{lastVisit.note}</p>
                <p className="text-xs text-gray-500 mt-2">{formatDate(lastVisit.date)}</p>
              </div>
            )}

            {openFollowUps.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-800 mb-3">Open Follow-ups</h2>

                {openFollowUps.map((visit) => (
                  <div key={visit.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 break-words">{visit.nextAction}</p>
                        <p className="text-xs text-gray-600 mt-1">{formatDate(visit.followUpDate)}</p>
                      </div>

                      <button
                        onClick={() => exportToCalendar(selectedClient, visit)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm whitespace-nowrap"
                      >
                        <FileDown size={16} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="font-semibold text-gray-800 mb-3">Visit History</h2>

            <div className="space-y-3">
              {clientVisits.map((visit) => (
                <div key={visit.id} className="border rounded-lg p-3 bg-white">
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <span className="text-xs text-gray-500">{formatDate(visit.date)}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap">{visit.touchType}</span>
                  </div>

                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{visit.note}</p>

                  {visit.outcome && (
                    <p className="text-xs text-gray-600 mt-1 break-words">Outcome: {visit.outcome}</p>
                  )}
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  };

  // =========================
  // Add Visit View
  // =========================
  const AddVisitView = () => {
    const [formData, setFormData] = useState({
      date: new Date().toISOString().split("T")[0],
      touchType: "Call",
      outcome: "",
      products: "",
      signal: "Warm",
      note: "",
      nextAction: "",
      followUpDate: ""
    });

    const handleSubmit = async (e) => {
      e.preventDefault();

      await dbOps.addVisit({
        clientId: selectedClient.id,
        ...formData,
        completed: false,
        priority: "medium"
      });

      const updatedClient = {
        ...selectedClient,
        lastVisitDate: formData.date,
        lastVisitSummary: formData.note
      };

      await dbOps.updateClient(updatedClient);

      await loadData();
      setCurrentView("clientDetail");
    };

    return (
      <div className="pt-4 max-w-2xl mx-auto">
        <button onClick={() => setCurrentView("clientDetail")} className="mb-4">
          <ArrowLeft size={24} />
        </button>

        <h1 className="text-2xl font-bold mb-6">Log Visit</h1>
        <p className="text-gray-600 mb-6">Client: {selectedClient?.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Touch Type</label>
            <select
              value={formData.touchType}
              onChange={(e) => setFormData({ ...formData, touchType: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Call">Call</option>
              <option value="Site Visit">Site Visit</option>
              <option value="Meeting">Meeting</option>
              <option value="Email">Email</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <input
              type="text"
              value={formData.outcome}
              onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
              placeholder="e.g., Discussed Project, Sent pics, etc."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Products Discussed</label>
            <input
              type="text"
              value={formData.products}
              onChange={(e) => setFormData({ ...formData, products: e.target.value })}
              placeholder="e.g., Calacatta Avenza, Harmony gold"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signal</label>
            <select
              value={formData.signal}
              onChange={(e) => setFormData({ ...formData, signal: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Hot">Hot 🔥</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (typed)</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="What happened during this visit?"
              rows={6}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Action</label>
            <input
              type="text"
              value={formData.nextAction}
              onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
              placeholder="What needs to happen next?"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date (optional)</label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Only set if there's a real deadline</p>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
            Save Visit
          </button>
        </form>
      </div>
    );
  };

  // =========================
  // Bottom Nav
  // =========================
  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex shadow-lg h-16">
      <button
        onClick={() => setCurrentView("home")}
        className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 ${
          currentView === "home" ? "text-blue-600" : "text-gray-600"
        }`}
      >
        <Calendar size={22} />
        <span className="text-xs">Follow-ups</span>
      </button>

      <button
        onClick={() => setCurrentView("clients")}
        className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 ${
          currentView === "clients" || currentView === "clientDetail" || currentView === "addVisit"
            ? "text-blue-600"
            : "text-gray-600"
        }`}
      >
        <Search size={22} />
        <span className="text-xs">Clients</span>
      </button>
    </div>
  );

  // =========================
  // Loading screen
  // =========================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // =========================
  // App Frame (responsive)
  // =========================
  return (
    <div className="bg-gray-50 min-h-screen w-full">
      {/* App content frame:
          - max width on desktop
          - full width on mobile
          - padding
          - pb-24 so bottom nav never covers content
      */}
      <div className="w-full px-4 pb-24">
        {currentView === "home" && <HomeView />}
        {currentView === "clients" && <ClientsView />}
        {currentView === "clientDetail" && <ClientDetailView />}
        {currentView === "addVisit" && <AddVisitView />}
      </div>

      <BottomNav />
    </div>
  );
}
