/**
 * Optimized LinkedIn Comments Scanner v0.6.0 - Readable Code
 * Author: Steffen Konrath, evAI Intelligence
 * 
 * NEW in v0.6.0:
 * - User-selectable comment threshold (20, 50, 100, 200, 500)
 * - Threshold persisted in localStorage
 * 
 * FIXES in v0.5.0:
 * - Improved scroll detection with retry logic (no more premature pausing)
 * - Multi-language support (DE/EN/FR/ES/PT/IT/NL)
 * - Better browser compatibility (replaced replaceAll, safer optional chaining)
 * - Increased scroll detection delay for slow connections
 * - MutationObserver for detecting new content
 * - AUTO-CLICK "Neue Beiträge anzeigen" / "Show new posts" button
 */

(function() {
  'use strict';

  // Configuration constants
  const CONFIG = Object.freeze({
    COMMENT_THRESHOLDS: [20, 50, 100, 200, 500],  // Selectable options
    DEFAULT_THRESHOLD: 100,
    SCROLL_INTERVAL_MS: 4000,
    OVERLAY_ID: 'commentOverlayResults',
    VERSION: '0.6.0',
    MAX_SCROLLS: 200,
    SCROLL_END_MARGIN: 150,           // Increased from 50
    SCROLL_DETECTION_DELAY: 2500,     // Increased from 1000
    CLICK_FEEDBACK_DURATION: 300,
    MAX_SCROLL_RETRIES: 3,            // NEW: Retry before pausing
    CONTENT_LOAD_TIMEOUT: 5000,       // NEW: Max wait for new content
    SELECTORS: {
      POSTS: 'div.feed-shared-update-v2',
      // Multi-language comment button selector
      COMMENT_BUTTON: [
        'button.social-details-social-counts__btn[aria-label*="Kommentar"]',  // DE
        'button.social-details-social-counts__btn[aria-label*="comment"]',    // EN
        'button.social-details-social-counts__btn[aria-label*="Comment"]',    // EN alt
        'button.social-details-social-counts__btn[aria-label*="commentaire"]', // FR
        'button.social-details-social-counts__btn[aria-label*="comentario"]', // ES
        'button.social-details-social-counts__btn[aria-label*="commento"]',   // IT
        'button.social-details-social-counts__btn[aria-label*="reactie"]',    // NL
        'button.social-details-social-counts__btn[aria-label*="comentário"]'  // PT
      ].join(', '),
      COMMENT_SPAN: 'span[aria-hidden="true"]',
      FEED_CONTAINER: 'main.scaffold-layout__main',
      // "Load more posts" button - multi-language
      LOAD_MORE_BUTTON: 'button.artdeco-button--secondary',
      LOAD_MORE_TEXTS: [
        'Neue Beiträge anzeigen',    // DE
        'Show new posts',             // EN
        'Afficher les nouveaux posts', // FR
        'Mostrar nuevas publicaciones', // ES
        'Mostra nuovi post',          // IT
        'Nieuwe berichten weergeven', // NL
        'Mostrar novas publicações',  // PT
        'Ver novas publicações'       // PT-BR
      ]
    }
  });

  // Application state
  class ScannerState {
    constructor() {
      this.scrollCount = 0;
      this.scrollInterval = null;
      this.results = [];
      this.seenPostIds = new Set();
      this.postsVisible = true;
      this.paused = false;
      this.isMinimized = false;
      this.overlayPosition = this.getSavedPosition();
      this.scrollFailureDetected = false;
      this.scrollRetryCount = 0;        // NEW: Track retries
      this.lastScrollHeight = 0;        // NEW: Track page growth
      this.mutationObserver = null;     // NEW: For content detection
      this.contentLoaded = false;       // NEW: Flag for new content
      this.commentThreshold = this.getSavedThreshold();  // NEW: User-selectable threshold
    }

    getSavedPosition() {
      try {
        return localStorage.getItem('scannerOverlayPosition') || 'right';
      } catch (e) {
        return 'right';
      }
    }

    getSavedThreshold() {
      try {
        const saved = parseInt(localStorage.getItem('scannerCommentThreshold'), 10);
        if (CONFIG.COMMENT_THRESHOLDS.indexOf(saved) !== -1) {
          return saved;
        }
      } catch (e) {}
      return CONFIG.DEFAULT_THRESHOLD;
    }

    setThreshold(value) {
      if (CONFIG.COMMENT_THRESHOLDS.indexOf(value) !== -1) {
        this.commentThreshold = value;
        try {
          localStorage.setItem('scannerCommentThreshold', value);
        } catch (e) {}
      }
    }

    reset() {
      this.scrollCount = 0;
      this.scrollFailureDetected = false;
      this.scrollRetryCount = 0;
      this.paused = false;
    }

    addResult(result) {
      // Avoid duplicates
      if (!this.results.some(r => r.link === result.link)) {
        this.results.unshift(result);
        return true;
      }
      return false;
    }
  }

  // Utility functions
  const Utils = {
    extractNumber(text) {
      // Compatible replacement for replaceAll (works in older browsers)
      const cleaned = text.replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
      const match = cleaned.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    },

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    createElement(tag, attributes, styles) {
      attributes = attributes || {};
      styles = styles || {};
      const element = document.createElement(tag);
      
      // Safe property assignment
      for (const key in attributes) {
        if (Object.prototype.hasOwnProperty.call(attributes, key)) {
          element[key] = attributes[key];
        }
      }
      
      // Safe style assignment
      for (const key in styles) {
        if (Object.prototype.hasOwnProperty.call(styles, key)) {
          try {
            element.style[key] = styles[key];
          } catch (e) {
            console.warn('Style assignment failed:', key, e);
          }
        }
      }
      
      return element;
    },

    getScrollInfo() {
      const maxScroll = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0
      );
      const currentScroll = window.scrollY || window.pageYOffset || 0;
      const windowHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const nearBottom = (currentScroll + windowHeight >= maxScroll - CONFIG.SCROLL_END_MARGIN);
      return { maxScroll, currentScroll, nearBottom, windowHeight };
    },

    // NEW: Safe way to get parent with data-id
    getParentWithDataId(element) {
      if (!element) return null;
      try {
        return element.closest('[data-id]');
      } catch (e) {
        // Fallback for older browsers without closest()
        let parent = element.parentElement;
        while (parent) {
          if (parent.getAttribute && parent.getAttribute('data-id')) {
            return parent;
          }
          parent = parent.parentElement;
        }
        return null;
      }
    }
  };

  // DOM manipulation utilities
  const DOM = {
    removeExisting(id) {
      const existing = document.getElementById(id);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    },

    createButton(text, color, onClick) {
      const button = Utils.createElement('button', 
        { textContent: text },
        {
          padding: '4px 8px',
          backgroundColor: color,
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          borderRadius: '6px',
          marginRight: '8px'
        }
      );
      
      button.onclick = onClick;
      this.addClickFeedback(button);
      return button;
    },

    addClickFeedback(button) {
      button.addEventListener('click', function() {
        const originalColor = button.style.backgroundColor;
        button.style.backgroundColor = '#d3d3d3';
        setTimeout(function() {
          button.style.backgroundColor = originalColor;
        }, CONFIG.CLICK_FEEDBACK_DURATION);
      });
    }
  };

  // Main scanner class
  class LinkedInScanner {
    constructor() {
      this.state = new ScannerState();
      this.init();
    }

    init() {
      if (!this.validateEnvironment()) return;
      this.setupMutationObserver();
      this.startScanning();
    }

    validateEnvironment() {
      if (window.location.href.indexOf("linkedin.com/feed") === -1) {
        alert(
          "Comments Scanner only works on your LinkedIn feed.\n" +
          "Please open https://www.linkedin.com/feed/ in this tab and start the Comments Scanner again."
        );
        return false;
      }
      return true;
    }

    // NEW: Setup MutationObserver to detect when new content loads
    setupMutationObserver() {
      const self = this;
      
      try {
        this.state.mutationObserver = new MutationObserver(function(mutations) {
          // Check if new post elements were added
          for (let i = 0; i < mutations.length; i++) {
            const mutation = mutations[i];
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
              for (let j = 0; j < mutation.addedNodes.length; j++) {
                const node = mutation.addedNodes[j];
                if (node.nodeType === 1) { // Element node
                  if (node.matches && node.matches(CONFIG.SELECTORS.POSTS)) {
                    self.state.contentLoaded = true;
                    return;
                  }
                  if (node.querySelector && node.querySelector(CONFIG.SELECTORS.POSTS)) {
                    self.state.contentLoaded = true;
                    return;
                  }
                }
              }
            }
          }
        });

        // Observe the main feed container or body
        const feedContainer = document.querySelector(CONFIG.SELECTORS.FEED_CONTAINER) || document.body;
        this.state.mutationObserver.observe(feedContainer, {
          childList: true,
          subtree: true
        });
      } catch (e) {
        console.warn('MutationObserver not available:', e);
      }
    }

    scanPosts() {
      const posts = document.querySelectorAll(CONFIG.SELECTORS.POSTS);
      let foundNew = 0;

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const dataId = this.getPostDataId(post);
        if (!this.isValidPost(dataId)) continue;

        this.state.seenPostIds.add(dataId);
        const commentCount = this.getCommentCount(post);

        if (commentCount >= this.state.commentThreshold) {
          const link = "https://www.linkedin.com/feed/update/" + dataId;
          const result = { link: link, comments: commentCount, postNode: post };
          
          if (this.state.addResult(result)) {
            foundNew++;
          }
        }
      }

      this.updateOverlay("Scroll #" + this.state.scrollCount + " — Found " + foundNew + " new | Total: " + this.state.results.length);
      return foundNew;
    }

    getPostDataId(post) {
      let dataId = post.getAttribute('data-id');
      if (!dataId) {
        const parentWithId = Utils.getParentWithDataId(post);
        dataId = parentWithId ? parentWithId.getAttribute('data-id') : null;
      }
      return dataId;
    }

    isValidPost(dataId) {
      return dataId && 
             !this.state.seenPostIds.has(dataId) && 
             dataId.indexOf('activity:') !== -1;
    }

    getCommentCount(post) {
      // Use multi-language selector
      const commentButton = post.querySelector(CONFIG.SELECTORS.COMMENT_BUTTON);
      if (!commentButton) return 0;

      const span = commentButton.querySelector(CONFIG.SELECTORS.COMMENT_SPAN);
      const commentText = span ? span.innerText.trim() : '';
      return Utils.extractNumber(commentText);
    }

    // NEW: Find and click "Neue Beiträge anzeigen" / "Show new posts" button
    clickLoadMoreButton() {
      const buttons = document.querySelectorAll(CONFIG.SELECTORS.LOAD_MORE_BUTTON);
      
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const buttonText = (button.textContent || button.innerText || '').trim();
        
        // Check if button text matches any of our load-more texts
        for (let j = 0; j < CONFIG.SELECTORS.LOAD_MORE_TEXTS.length; j++) {
          if (buttonText.indexOf(CONFIG.SELECTORS.LOAD_MORE_TEXTS[j]) !== -1) {
            console.log('🔘 Found "Load more" button: "' + buttonText + '" - clicking...');
            
            try {
              button.click();
              this.updateOverlay('Clicked "' + buttonText + '" - loading more posts...');
              return true;
            } catch (e) {
              console.warn('Failed to click load-more button:', e);
            }
          }
        }
      }
      
      return false;
    }

    scrollAndScan() {
      const self = this;
      
      if (this.state.paused || this.state.scrollFailureDetected) return;

      // NEW: Check for and click "Load more posts" button first
      if (this.clickLoadMoreButton()) {
        // Button was clicked - wait for content to load, then scan
        setTimeout(function() {
          self.scanPosts();
        }, 2000);
        return; // Don't scroll this cycle, let the button load content
      }

      const scrollInfo = Utils.getScrollInfo();
      const prevScroll = scrollInfo.currentScroll;
      const prevHeight = scrollInfo.maxScroll;
      
      this.state.scrollCount++;
      this.state.contentLoaded = false; // Reset content flag
      
      if (this.state.scrollCount >= CONFIG.MAX_SCROLLS) {
        this.handleMaxScrollsReached();
        return;
      }

      console.log("⬇️ Scrolling to: " + scrollInfo.maxScroll + " (Scroll #" + this.state.scrollCount + ")");
      
      try {
        window.scrollTo({ top: scrollInfo.maxScroll, behavior: 'smooth' });
      } catch (e) {
        // Fallback for older browsers
        window.scrollTo(0, scrollInfo.maxScroll);
      }

      // Wait for scroll and content to load
      setTimeout(function() {
        self.validateScroll(prevScroll, prevHeight);
      }, CONFIG.SCROLL_DETECTION_DELAY);
    }

    validateScroll(prevScroll, prevHeight) {
      const self = this;
      const scrollInfo = Utils.getScrollInfo();
      const currentScroll = scrollInfo.currentScroll;
      const currentHeight = scrollInfo.maxScroll;
      
      // Check if page grew (new content loaded) OR we actually scrolled OR mutation observer detected content
      const pageGrew = currentHeight > prevHeight + 100;
      const didScroll = Math.abs(currentScroll - prevScroll) > 50;
      const contentDetected = this.state.contentLoaded;

      console.log("📊 Scroll check: pageGrew=" + pageGrew + ", didScroll=" + didScroll + ", contentDetected=" + contentDetected + ", retries=" + this.state.scrollRetryCount);

      if (pageGrew || didScroll || contentDetected) {
        // Success - reset retry counter and scan
        this.state.scrollRetryCount = 0;
        this.scanPosts();
      } else if (scrollInfo.nearBottom) {
        // At bottom - check for "Load more" button first
        if (this.clickLoadMoreButton()) {
          console.log('🔘 Found load-more button at bottom - waiting for content...');
          this.state.scrollRetryCount = 0; // Reset retries since we found a button
          setTimeout(function() {
            self.scanPosts();
          }, 2000);
          return;
        }
        
        // No button found - increment retry counter
        this.state.scrollRetryCount++;
        
        if (this.state.scrollRetryCount >= CONFIG.MAX_SCROLL_RETRIES) {
          console.warn('⚠️ Reached bottom after ' + CONFIG.MAX_SCROLL_RETRIES + ' retries — no more content.');
          this.handleScrollFailure('end of feed reached (after ' + CONFIG.MAX_SCROLL_RETRIES + ' retries)');
        } else {
          // Wait longer and try again
          console.log('🔄 Retry ' + this.state.scrollRetryCount + '/' + CONFIG.MAX_SCROLL_RETRIES + ' - waiting for content...');
          this.updateOverlay('Waiting for content... (retry ' + this.state.scrollRetryCount + '/' + CONFIG.MAX_SCROLL_RETRIES + ')');
          
          setTimeout(function() {
            // Try scrolling again after extra wait
            self.scrollAndScan();
          }, CONFIG.CONTENT_LOAD_TIMEOUT);
        }
      } else {
        // Not at bottom but didn't scroll - might be a temporary issue
        this.state.scrollRetryCount++;
        
        if (this.state.scrollRetryCount >= CONFIG.MAX_SCROLL_RETRIES) {
          console.warn('⚠️ Scroll failed after ' + CONFIG.MAX_SCROLL_RETRIES + ' retries.');
          this.handleScrollFailure('scroll blocked (after ' + CONFIG.MAX_SCROLL_RETRIES + ' retries)');
        } else {
          console.log('🔄 Scroll retry ' + this.state.scrollRetryCount + '/' + CONFIG.MAX_SCROLL_RETRIES);
          this.scanPosts(); // Still scan what we have
        }
      }
    }

    handleMaxScrollsReached() {
      this.state.paused = true;
      this.stopScrolling();
      this.updateOverlay("Auto-paused after " + CONFIG.MAX_SCROLLS + " scrolls | Found: " + this.state.results.length);
      alert("Auto-scrolling paused after " + CONFIG.MAX_SCROLLS + " scrolls.\n\nFound " + this.state.results.length + " posts with 100+ comments.\n\nClick 'Resume' to continue.");
    }

    handleScrollFailure(reason) {
      this.state.paused = true;
      this.state.scrollFailureDetected = true;
      this.stopScrolling();
      this.updateOverlay("⚠️ Paused: " + reason + " | Found: " + this.state.results.length);
      alert(
        "⚠️ Comments Scanner paused: " + reason + "\n\n" +
        "Found " + this.state.results.length + " posts so far.\n\n" +
        "You can:\n" +
        "• Scroll down manually to load more content\n" +
        "• Click 'Resume' to continue scanning\n" +
        "• Export results with 'CSV Download'"
      );
    }

    startScanning() {
      const self = this;
      
      if (!this.state.scrollInterval) {
        this.state.lastScrollHeight = Utils.getScrollInfo().maxScroll;
        this.scrollAndScan();
        this.state.scrollInterval = setInterval(function() {
          self.scrollAndScan();
        }, CONFIG.SCROLL_INTERVAL_MS);
      }
    }

    stopScrolling() {
      if (this.state.scrollInterval) {
        clearInterval(this.state.scrollInterval);
        this.state.scrollInterval = null;
      }
    }

    togglePause() {
      if (this.state.paused) {
        this.state.reset();
        this.startScanning();
      } else {
        this.state.paused = true;
        this.stopScrolling();
      }
      this.updateOverlay();
    }

    toggleMinimize() {
      this.state.isMinimized = !this.state.isMinimized;
      this.updateOverlay();
    }

    togglePostsVisibility() {
      this.state.postsVisible = !this.state.postsVisible;
      const snippets = document.querySelectorAll("#" + CONFIG.OVERLAY_ID + " .post-snippet");
      for (let i = 0; i < snippets.length; i++) {
        snippets[i].style.display = this.state.postsVisible ? '' : 'none';
      }
      this.updateOverlay();
    }

    copyToClipboard() {
      const lines = [];
      for (let i = 0; i < this.state.results.length; i++) {
        const result = this.state.results[i];
        const idMatch = result.link.match(/activity:(\d+)/);
        const postId = idMatch ? idMatch[1] : result.link;
        lines.push("Post ID: " + postId + " — " + result.link + " — " + result.comments + " comments");
      }
      
      const text = lines.join('\n');
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          alert('Copied ' + lines.length + ' results to clipboard!');
        }).catch(function(err) {
          console.error('Clipboard failed:', err);
          this.fallbackCopy(text);
        }.bind(this));
      } else {
        this.fallbackCopy(text);
      }
    }

    fallbackCopy(text) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert('Copied to clipboard!');
      } catch (e) {
        alert('Copy failed. Please copy manually from console.');
        console.log(text);
      }
      document.body.removeChild(textarea);
    }

    downloadCSV() {
      const rows = [['Post ID', 'URL', 'Comments']];
      
      for (let i = 0; i < this.state.results.length; i++) {
        const result = this.state.results[i];
        const idMatch = result.link.match(/activity:(\d+)/);
        const postId = idMatch ? idMatch[1] : result.link;
        rows.push([postId, result.link, result.comments]);
      }

      const csvLines = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const escapedRow = [];
        for (let j = 0; j < row.length; j++) {
          escapedRow.push('"' + String(row[j]).replace(/"/g, '""') + '"');
        }
        csvLines.push(escapedRow.join(','));
      }
      const csvContent = csvLines.join('\n');
      
      try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'linkedin_posts_' + new Date().toISOString().split('T')[0] + '.csv';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert("Downloaded " + this.state.results.length + " results.");
      } catch (e) {
        console.error('Download failed:', e);
        alert('Download failed. Check console for data.');
        console.log(csvContent);
      }
    }

    close() {
      this.stopScrolling();
      
      // Cleanup MutationObserver
      if (this.state.mutationObserver) {
        this.state.mutationObserver.disconnect();
        this.state.mutationObserver = null;
      }
      
      DOM.removeExisting(CONFIG.OVERLAY_ID);
      
      // Cleanup
      this.state.seenPostIds.clear();
      this.state.results.length = 0;
    }

    // UI Creation methods
    createOverlay(statusText) {
      statusText = statusText || '';
      DOM.removeExisting(CONFIG.OVERLAY_ID);

      const overlay = this.createOverlayContainer();
      const header = this.createHeader();
      
      overlay.appendChild(header);

      if (!this.state.isMinimized) {
        const status = this.createStatusSection(statusText);
        const threshold = this.createThresholdSection();
        const controls = this.createControlsSection();
        const results = this.createResultsSection();
        
        overlay.appendChild(status);
        overlay.appendChild(threshold);
        overlay.appendChild(controls);
        overlay.appendChild(results);
      }

      document.body.appendChild(overlay);
    }

    createOverlayContainer() {
      const styles = {
        position: 'fixed',
        top: '10px',
        width: this.state.isMinimized ? '270px' : '500px',
        maxHeight: '90vh',
        overflowY: this.state.isMinimized ? 'hidden' : 'auto',
        zIndex: '99999',
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        borderRadius: '6px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        padding: this.state.isMinimized ? '5px 10px' : '10px',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
        cursor: 'default'
      };
      
      styles[this.state.overlayPosition] = '10px';
      
      if (this.state.isMinimized) {
        styles.height = '40px';
      }
      
      return Utils.createElement('div', { id: CONFIG.OVERLAY_ID }, styles);
    }

    createHeader() {
      const header = Utils.createElement('div', {}, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'move'
      });

      const title = Utils.createElement('h3', 
        { textContent: 'Comments Scanner v' + CONFIG.VERSION },
        { margin: '0', fontSize: '16px' }
      );

      const controls = this.createHeaderControls();
      
      header.appendChild(title);
      header.appendChild(controls);
      
      return header;
    }

    createHeaderControls() {
      const self = this;
      const container = Utils.createElement('div');
      
      const minBtn = DOM.createButton(
        this.state.isMinimized ? '+' : '−',
        '#888',
        function() { self.toggleMinimize(); }
      );
      minBtn.style.marginRight = '6px';

      const closeBtn = DOM.createButton('✕', '#6c757d', function() { self.close(); });
      closeBtn.style.marginRight = '0';

      container.appendChild(minBtn);
      container.appendChild(closeBtn);
      
      return container;
    }

    createStatusSection(statusText) {
      return Utils.createElement('div',
        { textContent: statusText || ('Found: ' + this.state.results.length + ' posts with ' + this.state.commentThreshold + '+ comments') },
        {
          margin: '8px 0',
          fontStyle: 'italic',
          color: '#666'
        }
      );
    }

    createThresholdSection() {
      const self = this;
      const container = Utils.createElement('div', {}, { 
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      });

      // Label
      const label = Utils.createElement('span', 
        { textContent: 'Min. Comments:' },
        { 
          fontSize: '13px',
          color: '#333',
          marginRight: '4px'
        }
      );
      container.appendChild(label);

      // Button group container
      const buttonGroup = Utils.createElement('div', {}, {
        display: 'flex',
        gap: '4px'
      });

      // Create a button for each threshold option
      for (let i = 0; i < CONFIG.COMMENT_THRESHOLDS.length; i++) {
        const threshold = CONFIG.COMMENT_THRESHOLDS[i];
        const isActive = (threshold === self.state.commentThreshold);
        
        const btn = Utils.createElement('button',
          { textContent: String(threshold) },
          {
            padding: '3px 8px',
            fontSize: '12px',
            border: isActive ? '2px solid #0073b1' : '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: isActive ? '#0073b1' : '#f5f5f5',
            color: isActive ? '#fff' : '#333',
            cursor: 'pointer',
            fontWeight: isActive ? 'bold' : 'normal',
            minWidth: '36px',
            transition: 'all 0.2s'
          }
        );

        // Hover effect
        btn.onmouseover = function() {
          if (threshold !== self.state.commentThreshold) {
            btn.style.backgroundColor = '#e0e0e0';
          }
        };
        btn.onmouseout = function() {
          if (threshold !== self.state.commentThreshold) {
            btn.style.backgroundColor = '#f5f5f5';
          }
        };

        // Click handler
        btn.onclick = function() {
          self.setThreshold(threshold);
        };

        buttonGroup.appendChild(btn);
      }

      container.appendChild(buttonGroup);
      return container;
    }

    setThreshold(value) {
      this.state.setThreshold(value);
      console.log('📊 Comment threshold changed to: ' + value);
      this.updateOverlay('Threshold set to ' + value + '+ comments');
    }

    createControlsSection() {
      const self = this;
      const container = Utils.createElement('div', {}, { marginBottom: '12px' });

      const buttons = [
        { text: this.state.paused ? 'Resume' : 'Pause', color: '#f0ad4e', action: function() { self.togglePause(); } },
        { text: 'Clipboard', color: '#5bc0de', action: function() { self.copyToClipboard(); } },
        { text: 'CSV Download', color: '#5cb85c', action: function() { self.downloadCSV(); } },
        { text: this.state.postsVisible ? 'Hide posts' : 'Show posts', color: '#888', action: function() { self.togglePostsVisibility(); } }
      ];

      for (let i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        container.appendChild(DOM.createButton(btn.text, btn.color, btn.action));
      }

      return container;
    }

    createResultsSection() {
      const container = Utils.createElement('div', { id: 'results-list' });

      for (let i = 0; i < this.state.results.length; i++) {
        const result = this.state.results[i];
        const idMatch = result.link.match(/activity:(\d+)/);
        const postId = idMatch ? idMatch[1] : result.link;
        
        const entry = Utils.createElement('div', {}, { marginBottom: '8px' });
        
        // Create button-styled link with arrow
        const linkBtn = Utils.createElement('a', 
          { 
            href: result.link, 
            target: '_blank',
            textContent: '➜ Open Post ID: ' + postId + ' — ' + result.comments + ' comments'
          },
          {
            display: 'inline-block',
            padding: '6px 12px',
            backgroundColor: '#0073b1',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            border: 'none',
            transition: 'background-color 0.2s'
          }
        );
        
        // Hover effects
        linkBtn.onmouseover = function() {
          linkBtn.style.backgroundColor = '#005582';
        };
        linkBtn.onmouseout = function() {
          linkBtn.style.backgroundColor = '#0073b1';
        };
        
        entry.appendChild(linkBtn);
        container.appendChild(entry);

        if (result.postNode) {
          const snippet = this.createPostSnippet(result.postNode);
          container.appendChild(snippet);
        }
      }

      return container;
    }

    createPostSnippet(postNode) {
      const cloned = postNode.cloneNode(true);
      cloned.className = (cloned.className || '') + ' post-snippet';
      
      cloned.style.maxWidth = '100%';
      cloned.style.border = '1px solid #ddd';
      cloned.style.marginBottom = '15px';
      cloned.style.padding = '5px';
      cloned.style.backgroundColor = '#fafafa';
      cloned.style.borderRadius = '6px';
      cloned.style.display = this.state.postsVisible ? '' : 'none';

      return cloned;
    }

    updateOverlay(statusText) {
      this.createOverlay(statusText);
    }
  }

  // Initialize the scanner
  const scanner = new LinkedInScanner();
  
  // Expose for debugging
  window.linkedInScanner = scanner;
})();
