// server/src/routes/githubRoutes.js

import express from "express";
import { getCached, setCache } from "../utils/githubCache.js";

const router = express.Router();

const GITHUB_API = "https://api.github.com";

// =========================================================
// HELPERS
// =========================================================

const getAuthHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "VELSAKA-PM",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
};

const githubFetch = async (path, options = {}) => {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `GitHub API error: ${response.status}`;
    let errors = [];

    try {
      const errorData = await response.json();

      if (errorData.message) message = errorData.message;

      if (Array.isArray(errorData.errors)) {
        errors = errorData.errors.map((e) =>
          typeof e === "string" ? e : e.message || JSON.stringify(e)
        );
      }
    } catch (_) {}

    console.error("GitHub API error response:", {
      status: response.status,
      path,
      message,
      errors,
      body: options.body,
    });

    const error = new Error(
      errors.length > 0
        ? `${message}: ${errors.join(", ")}`
        : message
    );
    error.status = response.status;
    error.errors = errors;
    throw error;
  }

  if (response.status === 204) return null;

  return response.json();
};

const parseGithubUrl = (url) => {
  if (!url) return null;

  let cleaned = String(url).trim();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^www\./, "");
  cleaned = cleaned.replace(/^github\.com\//, "");
  cleaned = cleaned.replace(/\.git$/, "");
  cleaned = cleaned.replace(/\/+$/, "");

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  return { owner: parts[0], repo: parts[1] };
};

const cleanGithubUsername = (input) => {
  if (!input) return "";

  let value = String(input).trim();
  value = value.replace(/\/+$/, "");

  if (value.startsWith("http")) {
    const parts = value.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  return value.replace(/^@/, "");
};

// =========================================================
// GET /api/github/stats
// =========================================================

router.get("/stats", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "GitHub URL is required",
      });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub repository URL",
      });
    }

    const { owner, repo } = parsed;
    const cacheKey = `repo:${owner}/${repo}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const [repoData, languages, contributors] = await Promise.all([
      githubFetch(`/repos/${owner}/${repo}`),
      githubFetch(`/repos/${owner}/${repo}/languages`),
      githubFetch(`/repos/${owner}/${repo}/contributors?per_page=10`),
    ]);

    const totalBytes = Object.values(languages).reduce(
      (sum, bytes) => sum + bytes,
      0
    );

    const languageList = Object.entries(languages)
      .map(([name, bytes]) => ({
        name,
        bytes,
        percent:
          totalBytes === 0
            ? 0
            : Math.round((bytes / totalBytes) * 1000) / 10,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    const stats = {
      owner,
      repo: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description || "",
      url: repoData.html_url,
      homepage: repoData.homepage || "",
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.watchers_count,
      openIssues: repoData.open_issues_count,
      defaultBranch: repoData.default_branch,
      language: repoData.language || "",
      topics: repoData.topics || [],
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      pushedAt: repoData.pushed_at,
      isPrivate: repoData.private,
      isFork: repoData.fork,
      archived: repoData.archived,
      license: repoData.license?.name || null,
      languages: languageList,
      contributors: contributors.slice(0, 10).map((c) => ({
        login: c.login,
        avatar: c.avatar_url,
        url: c.html_url,
        contributions: c.contributions,
      })),
    };

    setCache(cacheKey, stats);

    return res.json({ success: true, cached: false, ...stats });
  } catch (error) {
    console.error("GitHub stats error:", error);

    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: "GitHub repository not found (or is private)",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch GitHub stats",
    });
  }
});

// =========================================================
// GET /api/github/collaborators
// Returns BOTH accepted collaborators + pending invitations
// ✅ ONLY ONE definition (no duplicates)
// =========================================================

router.get("/collaborators", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "GitHub URL is required",
      });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub repository URL",
      });
    }

    const { owner, repo } = parsed;
    const cacheKey = `collab:${owner}/${repo}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        collaborators: cached,
      });
    }

    // Fetch BOTH in parallel
    const [collaborators, invitations] = await Promise.all([
      githubFetch(
        `/repos/${owner}/${repo}/collaborators?per_page=100`
      ).catch((err) => {
        console.warn(
          "Failed to fetch collaborators:",
          err.message
        );
        return [];
      }),

      githubFetch(`/repos/${owner}/${repo}/invitations`).catch(
        (err) => {
          console.warn(
            "Failed to fetch invitations:",
            err.message
          );
          return [];
        }
      ),
    ]);

    console.log("=== COLLABORATORS DEBUG ===");
    console.log("Accepted count:", collaborators.length);
    console.log("Invitations count:", invitations.length);
    console.log(
      "Accepted logins:",
      collaborators.map((c) => c.login)
    );
    console.log(
      "Pending logins:",
      invitations.map((i) => i.invitee?.login)
    );
    console.log("===========================");

    // Get permissions for accepted collaborators
    const detailed = await Promise.all(
      collaborators.map(async (c) => {
        try {
          const perm = await githubFetch(
            `/repos/${owner}/${repo}/collaborators/${c.login}/permission`
          );

          return {
            login: c.login,
            avatar: c.avatar_url,
            url: c.html_url,
            permission: perm.permission || "read",
            role: perm.role_name || perm.permission || "read",
            status: "accepted",
          };
        } catch (_) {
          return {
            login: c.login,
            avatar: c.avatar_url,
            url: c.html_url,
            permission: "unknown",
            role: "unknown",
            status: "accepted",
          };
        }
      })
    );

    // Build pending list, skipping accepted
    const acceptedLogins = new Set(
      detailed.map((c) => c.login.toLowerCase())
    );

    const pending = invitations
      .filter(
        (inv) =>
          !acceptedLogins.has(inv.invitee?.login?.toLowerCase())
      )
      .map((inv) => ({
        login: inv.invitee?.login || "unknown",
        avatar: inv.invitee?.avatar_url || "",
        url: inv.invitee?.html_url || "",
        permission: inv.permissions || "push",
        role: inv.permissions || "push",
        status: "pending",
        invitedAt: inv.created_at,
      }));

    // Merge
    const all = [...detailed, ...pending];

    setCache(cacheKey, all, 60 * 1000);

    return res.json({
      success: true,
      cached: false,
      collaborators: all,
    });
  } catch (error) {
    console.error("GitHub collaborators error:", error);

    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Your GITHUB_TOKEN needs 'repo' scope.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch collaborators",
    });
  }
});

// =========================================================
// POST /api/github/collaborators
// =========================================================

router.post("/collaborators", async (req, res) => {
  try {
    const { url, username, permission = "push" } = req.body || {};

    if (!url || !username) {
      return res.status(400).json({
        success: false,
        message: "Repository URL and username are required",
      });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        message: "GITHUB_TOKEN is not configured",
      });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub repository URL",
      });
    }

    const cleanUsername = cleanGithubUsername(username);

    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub username",
      });
    }

    const { owner, repo } = parsed;

    const validPermissions = [
      "pull",
      "triage",
      "push",
      "maintain",
      "admin",
    ];
    const finalPermission = validPermissions.includes(permission)
      ? permission
      : "push";

    await githubFetch(
      `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(
        cleanUsername
      )}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: finalPermission }),
      }
    );

    setCache(`collab:${owner}/${repo}`, null, 0);

    return res.json({
      success: true,
      message: `Invitation sent to @${cleanUsername} (${finalPermission})`,
    });
  } catch (error) {
    console.error("Add collaborator error:", error);

    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: "Repository or GitHub user not found",
      });
    }

    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Your GITHUB_TOKEN needs 'repo' scope + admin access to the repo.",
      });
    }

    if (error.status === 422) {
      return res.status(422).json({
        success: false,
        message: "Invalid username or cannot add this collaborator",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add collaborator",
    });
  }
});

// =========================================================
// POST /api/github/collaborators/bulk
// =========================================================

router.post("/collaborators/bulk", async (req, res) => {
  try {
    const { url, collaborators = [] } = req.body || {};

    if (!url || !Array.isArray(collaborators) || collaborators.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Repository URL and collaborators array are required",
      });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        message: "GITHUB_TOKEN is not configured",
      });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub repository URL",
      });
    }

    const { owner, repo } = parsed;
    const validPermissions = ["pull", "triage", "push", "maintain", "admin"];

    const results = await Promise.all(
      collaborators.map(async ({ username, permission = "push" }) => {
        const cleanUsername = cleanGithubUsername(username);

        if (!cleanUsername) {
          return {
            username,
            success: false,
            message: "Invalid username",
          };
        }

        try {
          const finalPermission = validPermissions.includes(permission)
            ? permission
            : "push";

          await githubFetch(
            `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(
              cleanUsername
            )}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ permission: finalPermission }),
            }
          );

          return {
            username: cleanUsername,
            success: true,
            message: `Invitation sent to @${cleanUsername}`,
          };
        } catch (err) {
          return {
            username: cleanUsername,
            success: false,
            message:
              err.status === 404
                ? `User @${cleanUsername} not found on GitHub`
                : err.message || `Failed to add @${cleanUsername}`,
          };
        }
      })
    );

    setCache(`collab:${owner}/${repo}`, null, 0);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return res.json({
      success: true,
      message: `Added ${successCount} collaborator${
        successCount !== 1 ? "s" : ""
      }${failCount > 0 ? `, ${failCount} failed` : ""}`,
      results,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error("Bulk add collaborators error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add collaborators",
    });
  }
});

// =========================================================
// DELETE /api/github/collaborators
// =========================================================

router.delete("/collaborators", async (req, res) => {
  try {
    const { url, username } = req.body || {};

    if (!url || !username) {
      return res.status(400).json({
        success: false,
        message: "Repository URL and username are required",
      });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        message: "GITHUB_TOKEN is not configured",
      });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub repository URL",
      });
    }

    const cleanUsername = cleanGithubUsername(username);
    const { owner, repo } = parsed;

    await githubFetch(
      `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(
        cleanUsername
      )}`,
      { method: "DELETE" }
    );

    setCache(`collab:${owner}/${repo}`, null, 0);

    return res.json({
      success: true,
      message: `Removed @${cleanUsername} from collaborators`,
    });
  } catch (error) {
    console.error("Remove collaborator error:", error);

    if (error.status === 404) {
      return res.status(404).json({
        success: false,
        message: "User is not a collaborator or repo not found",
      });
    }

    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        message: "Permission denied. Check GITHUB_TOKEN scope.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to remove collaborator",
    });
  }
});

// =========================================================
// GET /api/github/commits
// =========================================================

router.get("/commits", async (req, res) => {
  try {
    const { url, limit = 5 } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "GitHub URL is required",
      });
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub repository URL",
      });
    }

    const { owner, repo } = parsed;
    const cacheKey = `commits:${owner}/${repo}:${limit}`;

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        commits: cached,
      });
    }

    const commits = await githubFetch(
      `/repos/${owner}/${repo}/commits?per_page=${limit}`
    );

    const simplified = commits.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit.message.split("\n")[0],
      author: {
        name: c.commit.author?.name || "",
        login: c.author?.login || "",
        avatar: c.author?.avatar_url || "",
      },
      date: c.commit.author?.date,
      url: c.html_url,
    }));

    setCache(cacheKey, simplified, 2 * 60 * 1000);

    return res.json({
      success: true,
      cached: false,
      commits: simplified,
    });
  } catch (error) {
    console.error("GitHub commits error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch commits",
    });
  }
});

// =========================================================
// POST /api/github/create-repo
// =========================================================

router.post("/create-repo", async (req, res) => {
  try {
    const {
      name,
      description = "",
      private: isPrivate = true,
      autoInit = true,
      gitignoreTemplate = "",
      licenseTemplate = "",
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Repository name is required",
      });
    }

    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        message: "GITHUB_TOKEN is not configured",
      });
    }

    const cleanName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_.]/g, "");

    const body = {
      name: cleanName,
      description: (description || "").trim(),
      private: Boolean(isPrivate),
      auto_init: Boolean(autoInit),
      has_issues: true,
      has_projects: true,
      has_wiki: false,
    };

    if (autoInit) {
      const gi = (gitignoreTemplate || "").trim();
      const lic = (licenseTemplate || "").trim().toLowerCase();

      if (gi) body.gitignore_template = gi;
      if (lic) body.license_template = lic;
    }

    console.log("=================================");
    console.log("CREATE REPO REQUEST");
    console.log("Body:", JSON.stringify(body, null, 2));
    console.log("=================================");

    const org = (process.env.GITHUB_ORG || "").trim();
    const endpoint = org
      ? `/orgs/${encodeURIComponent(org)}/repos`
      : `/user/repos`;

    const repoData = await githubFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log("Repo created:", repoData.full_name);

    return res.status(201).json({
      success: true,
      message: org
        ? `Repository "${repoData.name}" created in ${org}`
        : `Repository "${repoData.name}" created in your account`,
      repo: {
        name: repoData.name,
        fullName: repoData.full_name,
        url: repoData.html_url,
        cloneUrl: repoData.clone_url,
        sshUrl: repoData.ssh_url,
        description: repoData.description || "",
        private: repoData.private,
        defaultBranch: repoData.default_branch,
        owner: repoData.owner.login,
      },
    });
  } catch (error) {
    console.error("Create repo error:", error);

    const githubErrors =
      Array.isArray(error.errors) && error.errors.length > 0
        ? ` (${error.errors
            .map((e) =>
              typeof e === "string"
                ? e
                : `${e.field || "error"}: ${e.message || ""}`
            )
            .filter(Boolean)
            .join("; ")})`
        : "";

    if (error.status === 422) {
      return res.status(422).json({
        success: false,
        message:
          (error.message || "Repository creation failed") +
          githubErrors,
      });
    }

    if (error.status === 403) {
      return res.status(403).json({
        success: false,
        message:
          "Permission denied. Your GITHUB_TOKEN needs 'repo' scope.",
      });
    }

    if (error.status === 404) {
      const org = (process.env.GITHUB_ORG || "").trim();
      return res.status(404).json({
        success: false,
        message: org
          ? `Organization "${org}" not found or you don't have access.`
          : "User not found. Check your GITHUB_TOKEN.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create repository",
    });
  }
});

// =========================================================
// GET /api/github/whoami
// =========================================================

router.get("/whoami", async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        success: false,
        message: "GITHUB_TOKEN is not configured",
      });
    }

    const user = await githubFetch("/user");

    return res.json({
      success: true,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar: user.avatar_url,
        url: user.html_url,
      },
    });
  } catch (error) {
    console.error("Whoami error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch GitHub user",
    });
  }
});

// =========================================================
// GET /api/github/templates
// =========================================================

router.get("/templates", async (req, res) => {
  try {
    const cacheKey = "templates";

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    const [gitignore, licenses] = await Promise.all([
      githubFetch("/gitignore/templates"),
      githubFetch("/licenses"),
    ]);

    const data = {
      gitignore: gitignore.map((name) => ({
        value: name,
        label: name,
      })),
      licenses: licenses.map((l) => ({
        value: l.key,
        label: l.name,
        spdx: l.spdx_id,
      })),
    };

    setCache(cacheKey, data, 60 * 60 * 1000);

    return res.json({ success: true, cached: false, ...data });
  } catch (error) {
    console.error("Templates error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch templates",
    });
  }
});

export default router;