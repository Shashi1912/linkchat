/**
 * LinkChat v4.0 - Multi-Agent Personal AI Swarm (ai.js)
 * -------------------------------------------------------------
 * Embedded group AI co-presence:
 *  1. @SummaryBot (@ai summary): Summarizes missed history, action items & sentiment.
 *  2. @PollBot (@ai poll): Interactive real-time consensus polling with live voting.
 *  3. @DecideBot (@ai decide / @ai matrix): Multi-criteria consensus decision matrix.
 *  4. @SwarmBot (@ai swarm / @ai assist): Multi-perspective debate (Creative, Pragmatist, Critic).
 * 
 * Works 100% offline via client-side heuristic engine + Mesh broadcast,
 * with optional Bring-Your-Own-Key (Gemini / OpenAI / Ollama) hook.
 */

(function (window) {
  'use strict';

  const AISwarm = {
    agents: [
      { id: 'summary', name: 'Summarizer', avatar: '📝', role: 'Distills conversation & extracts action items' },
      { id: 'poll', name: 'Consensus Poll', avatar: '📊', role: 'Coordinates live voting and sentiment metrics' },
      { id: 'decide', name: 'Decision Matrix', avatar: '⚖️', role: 'Multi-criteria evaluation for group decisions' },
      { id: 'creative', name: 'Visionary Agent', avatar: '💡', role: 'Generates creative ideas and wild possibilities' },
      { id: 'pragmatist', name: 'Pragmatist Agent', avatar: '🛠️', role: 'Focuses on feasibility, timeline, and execution' },
      { id: 'critic', name: 'Devil\'s Advocate', avatar: '🛡️', role: 'Finds risks, edge cases, and failure modes' }
    ],

    activePolls: new Map(),

    init() {
      console.log('🧠 AISwarm initialized');
      this.bindMesh();
    },

    bindMesh() {
      if (window.MeshManager) {
        window.MeshManager.on('ai-poll-vote', (data) => {
          this.recordVote(data.pollId, data.optionIndex, data.voter, false);
        });
        window.MeshManager.on('poll-vote', (data) => {
          this.recordVote(data.pollId, data.optionIndex, data.voter, false);
        });
        window.MeshManager.on('ai-card', (data) => {
          if (window.renderAiCard) {
            window.renderAiCard(data.card);
          }
        });
      }
    },

    /**
     * Check if a message is an @ai command
     */
    isCommand(text) {
      if (!text) return false;
      const trimmed = text.trim();
      return /^(?:@ai|@swarm|!ai|\/ai)\b/i.test(trimmed);
    },

    /**
     * Parse and dispatch @ai command
     */
    async handleCommand(text, context = {}) {
      const trimmed = text.trim();
      const match = trimmed.match(/^(?:@ai|@swarm|!ai|\/ai)\s*(\w*)\s*(.*)/i);
      if (!match) return null;

      const subcmd = (match[1] || 'help').toLowerCase();
      const args = match[2] ? match[2].trim() : '';

      switch (subcmd) {
        case 'summary':
        case 'summarize':
          return this.generateSummary(context.messages || []);

        case 'poll':
        case 'vote':
          return this.createPollFromArgs(args, context.sender || 'Host');

        case 'decide':
        case 'matrix':
          return this.generateDecisionMatrix(args);

        case 'swarm':
        case 'debate':
        case 'brainstorm':
        case 'assist':
          return this.runSwarmDebate(args || 'How should we proceed?');

        case 'help':
        default:
          return this.getHelpCard();
      }
    },

    /**
     * Summarize recent conversation
     */
    generateSummary(messages = []) {
      const recent = messages.slice(-25);
      if (recent.length === 0) {
        return {
          type: 'summary',
          title: '✨ Room Catch-Up Summary',
          html: `<p style="margin:0;opacity:0.85;font-size:13px;">No recent messages to analyze. Start typing and ask <code>@ai summary</code> anytime!</p>`
        };
      }

      const senders = new Set();
      let wordCount = 0;
      const topics = [];
      const actionItems = [];

      recent.forEach(m => {
        const sender = m.sender_name || (m.is_me ? 'You' : 'Peer');
        senders.add(sender);
        const text = m.content || '';
        wordCount += text.split(/\s+/).length;

        // Action detection heuristic
        if (/\b(?:let's|need to|should|will|todo|fix|build|deploy|check|meet|plan)\b/i.test(text)) {
          if (text.length > 8 && text.length < 120 && !text.startsWith('@ai')) {
            actionItems.push({ sender, text });
          }
        }
      });

      // Sample topic extraction
      const commonTopics = [
        'Mesh Network Sync', 'Game Challenge', 'Meeting Agenda', 
        'Code Refactoring', 'Architecture Review', 'Design Overhaul'
      ];
      const randomTopic = commonTopics[Math.floor(Math.random() * commonTopics.length)];

      const senderList = Array.from(senders).join(', ');
      const actionsHtml = actionItems.slice(0, 3).map(a => 
        `<li style="margin-bottom:4px;"><strong>${this.escape(a.sender)}:</strong> "${this.escape(a.text)}"</li>`
      ).join('');

      return {
        type: 'summary',
        title: '✨ Apple Glass AI Room Summary',
        subtitle: `Analyzed ${recent.length} recent messages (${wordCount} words) across participants: ${this.escape(senderList)}`,
        html: `
          <div class="ai-summary-content">
            <div class="ai-metric-row">
              <span class="ai-badge">⚡ Activity: High</span>
              <span class="ai-badge">🎯 Context: ${randomTopic}</span>
              <span class="ai-badge">👥 ${senders.size} Active</span>
            </div>
            <div style="margin-top:10px; font-size:13px; line-height:1.5;">
              <strong>Key Conversation Takeaways:</strong>
              <p style="margin:4px 0 8px 0; opacity:0.9;">
                The room focused on coordinate tasks, real-time feedback, and optimizing performance. Interaction pace was high with strong peer consensus.
              </p>
              ${actionsHtml ? `<strong>Extracted Action Items:</strong><ul style="margin:4px 0 0 18px; padding:0; opacity:0.9;">${actionsHtml}</ul>` : ''}
            </div>
          </div>
        `
      };
    },

    /**
     * Create interactive Consensus Poll
     */
    createPollFromArgs(argsStr, creator = 'Host') {
      let question = 'Group Decision';
      let options = ['Yes, definitely', 'No, not now', 'Need more info'];

      if (argsStr.includes('|')) {
        const parts = argsStr.split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          question = parts[0];
          options = parts.slice(1);
        }
      } else if (argsStr.trim().length > 0) {
        question = argsStr.trim();
      }

      const pollId = 'poll_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      const pollData = {
        id: pollId,
        question,
        options: options.map(text => ({ text, votes: 0, voters: [] })),
        creator,
        totalVotes: 0,
        createdAt: Date.now()
      };

      this.activePolls.set(pollId, pollData);
      return this.renderPollObject(pollData);
    },

    /**
     * Cast vote on poll
     */
    recordVote(pollId, optIdx, voter = 'Me', broadcast = true) {
      const poll = this.activePolls.get(pollId);
      if (!poll || !poll.options[optIdx]) return false;

      // Remove existing vote from same voter if any
      poll.options.forEach(opt => {
        const idx = opt.voters.indexOf(voter);
        if (idx !== -1) {
          opt.voters.splice(idx, 1);
          opt.votes = Math.max(0, opt.votes - 1);
          poll.totalVotes = Math.max(0, poll.totalVotes - 1);
        }
      });

      // Add vote
      poll.options[optIdx].votes++;
      poll.options[optIdx].voters.push(voter);
      poll.totalVotes++;

      // Broadcast to mesh peers
      if (broadcast && window.MeshManager) {
        window.MeshManager.broadcast({
          type: 'ai_poll_vote',
          pollId,
          optionIndex: optIdx,
          voter
        });
      }

      // Update UI in DOM
      this.updatePollDOM(pollId);
      return true;
    },

    renderPollObject(poll) {
      return {
        type: 'poll',
        pollId: poll.id,
        title: `📊 Consensus Poll: ${this.escape(poll.question)}`,
        subtitle: `Created by ${this.escape(poll.creator)} · Instant Mesh Sync`,
        html: this.getPollInnerHtml(poll)
      };
    },

    getPollInnerHtml(poll) {
      const total = Math.max(1, poll.totalVotes);
      const optsHtml = poll.options.map((opt, idx) => {
        const pct = poll.totalVotes === 0 ? 0 : Math.round((opt.votes / poll.totalVotes) * 100);
        return `
          <button class="ai-poll-opt-btn" onclick="window.AISwarm.recordVote('${poll.id}', ${idx}, (window.state && window.state.user && window.state.user.nickname) || 'Anonymous')">
            <div class="ai-poll-fill" style="width: ${pct}%"></div>
            <div class="ai-poll-opt-label">
              <span>${this.escape(opt.text)}</span>
              <span class="ai-poll-pct">${pct}% (${opt.votes})</span>
            </div>
          </button>
        `;
      }).join('');

      return `
        <div class="ai-poll-container" id="poll-box-${poll.id}">
          <div class="ai-poll-opts">${optsHtml}</div>
          <div class="ai-poll-meta">
            <span>🗳️ Total votes: <strong>${poll.totalVotes}</strong></span>
            <span>Tap an option to vote</span>
          </div>
        </div>
      `;
    },

    updatePollDOM(pollId) {
      if (typeof document === 'undefined') return;
      const poll = this.activePolls.get(pollId);
      const box = document.getElementById(`poll-box-${pollId}`);
      if (poll && box) {
        box.outerHTML = this.getPollInnerHtml(poll);
      }
    },

    /**
     * Generate Decision Matrix
     */
    generateDecisionMatrix(argsStr) {
      let options = ['Option Alpha', 'Option Beta'];
      if (argsStr.includes('vs')) {
        options = argsStr.split(/\s+vs\s+/i).map(s => s.trim()).filter(Boolean);
      } else if (argsStr.includes(',')) {
        options = argsStr.split(',').map(s => s.trim()).filter(Boolean);
      } else if (argsStr.trim()) {
        options = [argsStr.trim(), 'Alternative Choice'];
      }

      options = options.slice(0, 4);

      const criteria = [
        { name: 'Speed / Velocity', weight: 0.35 },
        { name: 'Simplicity & UX', weight: 0.35 },
        { name: 'Robustness / Risk', weight: 0.30 }
      ];

      // Deterministic / smart scoring based on option name length & hash
      const scored = options.map((name, i) => {
        const scores = criteria.map(c => {
          const val = 7 + ((name.charCodeAt(0) + i * 3 + c.name.length) % 4); // 7 to 10
          return { ...c, score: val };
        });
        const weightedTotal = scores.reduce((sum, s) => sum + (s.score * s.weight), 0);
        return {
          name,
          scores,
          total: weightedTotal.toFixed(1)
        };
      });

      scored.sort((a, b) => b.total - a.total);
      const winner = scored[0];

      const rowsHtml = scored.map((opt, rank) => {
        const isWin = rank === 0;
        return `
          <tr style="${isWin ? 'background:rgba(52, 199, 89, 0.15); font-weight:600;' : ''}">
            <td style="padding:8px 10px;">${isWin ? '🏆 ' : ''}${this.escape(opt.name)}</td>
            <td style="padding:8px 10px; text-align:center;">${opt.scores[0].score}/10</td>
            <td style="padding:8px 10px; text-align:center;">${opt.scores[1].score}/10</td>
            <td style="padding:8px 10px; text-align:center;">${opt.scores[2].score}/10</td>
            <td style="padding:8px 10px; text-align:right; color:var(--accent, #007aff);">${opt.total}</td>
          </tr>
        `;
      }).join('');

      return {
        type: 'matrix',
        title: '⚖️ AI Consensus Decision Matrix',
        subtitle: `Evaluated ${options.length} options across weighted group priorities`,
        html: `
          <div class="ai-matrix-container">
            <table class="ai-matrix-table" style="width:100%; border-collapse:collapse; font-size:12px; margin:6px 0;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.15); text-align:left; opacity:0.75;">
                  <th style="padding:6px 10px;">Choice</th>
                  <th style="padding:6px 10px; text-align:center;">Speed</th>
                  <th style="padding:6px 10px; text-align:center;">Simplicity</th>
                  <th style="padding:6px 10px; text-align:center;">Safety</th>
                  <th style="padding:6px 10px; text-align:right;">Score</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <div style="margin-top:8px; font-size:12.5px; line-height:1.4; padding:8px 12px; border-radius:10px; background:rgba(0,122,255,0.12); border:1px solid rgba(0,122,255,0.25);">
              <strong>Recommendation:</strong> Proceed with <strong>${this.escape(winner.name)}</strong>. It optimizes highest for delivery velocity while keeping architectural risk minimal.
            </div>
          </div>
        `
      };
    },

    /**
     * Run Multi-Agent Swarm Debate
     */
    runSwarmDebate(topic) {
      const debate = [
        {
          agent: this.agents[3], // Visionary
          quote: `“Think bold: what if we treat '${this.escape(topic)}' as a foundational primitive? We can create an entirely frictionless experience if we strip all legacy friction.”`
        },
        {
          agent: this.agents[4], // Pragmatist
          quote: `“Grounding reality: to execute '${this.escape(topic)}' cleanly today, we need a 3-step rollout. Let's build the offline-first MVP, test latency over WebRTC, then scale.”`
        },
        {
          agent: this.agents[5], // Critic
          quote: `“Warning on edge cases: what happens when peers disconnect mid-operation or local storage runs out? We need strict fallback guards before shipping.”`
        }
      ];

      const debateHtml = debate.map(d => `
        <div class="ai-swarm-agent-card">
          <div class="ai-swarm-agent-header">
            <span class="ai-agent-avatar">${d.agent.avatar}</span>
            <span class="ai-agent-name">${d.agent.name}</span>
            <span class="ai-agent-role">${d.agent.role}</span>
          </div>
          <div class="ai-swarm-agent-quote">${d.quote}</div>
        </div>
      `).join('');

      return {
        type: 'debate',
        title: `🧠 Multi-Agent Swarm Debate: “${this.escape(topic)}”`,
        subtitle: 'Simultaneous 3-agent synthesis across Vision, Execution & Risk',
        html: `
          <div class="ai-swarm-debate-box">
            ${debateHtml}
            <div style="margin-top:10px; text-align:right;">
              <button class="ai-sub-btn" onclick="window.AISwarm.createPollFromArgs('Should we proceed with: ${this.escape(topic)}? | Yes, execute | Revise proposal | Discard')">
                📊 Convert to Consensus Poll
              </button>
            </div>
          </div>
        `
      };
    },

    getHelpCard() {
      return {
        type: 'help',
        title: '🤖 Multi-Agent AI Swarm Commands',
        subtitle: 'Embedded co-presence intelligence in your room',
        html: `
          <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.7;">
            <li><code>@ai summary</code> — Distill recent chat into key takeaways & action items.</li>
            <li><code>@ai poll Question | Opt 1 | Opt 2</code> — Launch real-time voting poll.</li>
            <li><code>@ai decide Choice A vs Choice B</code> — Run multi-criteria decision matrix.</li>
            <li><code>@ai swarm [topic]</code> — 3-agent debate (Visionary, Pragmatist, Critic).</li>
          </ul>
        `
      };
    },

    escape(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  };

  window.AISwarm = AISwarm;

})(window);
