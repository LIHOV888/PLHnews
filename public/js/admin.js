// Admin Panel JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Handle bulk actions
  const bulkActionForms = document.querySelectorAll('.bulk-action-form');
  bulkActionForms.forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();

      const selectedItems = document.querySelectorAll('input[name="itemIds"]:checked');
      if (selectedItems.length === 0) {
        alert('Please select at least one item.');
        return;
      }

      const action = this.querySelector('select[name="action"]').value;
      if (!action) {
        alert('Please select an action.');
        return;
      }

      if (!confirm(`Are you sure you want to ${action} ${selectedItems.length} item(s)?`)) {
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('action', action);
      selectedItems.forEach(item => {
        formData.append('articleIds[]', item.value);
      });

      // Submit the form
      fetch(this.action, {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          location.reload();
        } else {
          alert('Error: ' + (data.error || 'Unknown error occurred'));
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while processing your request.');
      });
    });
  });

  // Handle select all checkbox
  const selectAllCheckboxes = document.querySelectorAll('.select-all');
  selectAllCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const table = this.closest('table');
      const itemCheckboxes = table.querySelectorAll('tbody input[type="checkbox"]');
      itemCheckboxes.forEach(itemCheckbox => {
        itemCheckbox.checked = this.checked;
      });
    });
  });

  // Handle user role changes
  const roleSelects = document.querySelectorAll('.user-role-select');
  roleSelects.forEach(select => {
    select.addEventListener('change', function() {
      const userId = this.dataset.userId;
      const newRole = this.value;

      fetch(`/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showAlert('User role updated successfully', 'success');
        } else {
          showAlert('Error updating user role', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while updating user role', 'error');
      });
    });
  });

  // Handle user ban/unban
  const banButtons = document.querySelectorAll('.ban-user-btn');
  banButtons.forEach(button => {
    button.addEventListener('click', function() {
      const userId = this.dataset.userId;
      const isBanned = this.dataset.banned === 'true';
      const action = isBanned ? 'unban' : 'ban';

      if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
      }

      fetch(`/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          location.reload();
        } else {
          showAlert('Error updating user status', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while updating user status', 'error');
      });
    });
  });

  // Handle comment deletion
  const deleteCommentButtons = document.querySelectorAll('.delete-comment-btn');
  deleteCommentButtons.forEach(button => {
    button.addEventListener('click', function() {
      const commentId = this.dataset.commentId;

      if (!confirm('Are you sure you want to delete this comment?')) {
        return;
      }

      fetch(`/admin/comments/${commentId}/delete`, {
        method: 'POST'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.closest('tr').remove();
          showAlert('Comment deleted successfully', 'success');
        } else {
          showAlert('Error deleting comment', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while deleting comment', 'error');
      });
    });
  });

  // Handle article deletion
  const deleteArticleButtons = document.querySelectorAll('.delete-article-btn');
  deleteArticleButtons.forEach(button => {
    button.addEventListener('click', function() {
      const articleId = this.dataset.articleId;

      if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
        return;
      }

      fetch(`/admin/articles/${articleId}/delete`, {
        method: 'POST'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.closest('tr').remove();
          showAlert('Article deleted successfully', 'success');
        } else {
          showAlert('Error deleting article', 'error');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showAlert('An error occurred while deleting article', 'error');
      });
    });
  });

  // Handle file uploads with preview
  const imageInputs = document.querySelectorAll('input[type="file"][accept*="image"]');
  imageInputs.forEach(input => {
    input.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const preview = input.parentElement.querySelector('.image-preview');
          if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  });

  // Auto-submit search forms
  const searchInputs = document.querySelectorAll('.auto-search');
  searchInputs.forEach(input => {
    let timeout;
    input.addEventListener('input', function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.closest('form').submit();
      }, 500);
    });
  });

  // Handle filter toggles
  const filterToggles = document.querySelectorAll('.filter-toggle');
  filterToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const filterPanel = document.querySelector('.filter-panel');
      if (filterPanel) {
        filterPanel.classList.toggle('show');
      }
    });
  });
});

// Utility function to show alerts
function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `admin-alert admin-alert-${type}`;
  alertDiv.textContent = message;

  const container = document.querySelector('.admin-content') || document.body;
  container.insertBefore(alertDiv, container.firstChild);

  // Auto remove after 5 seconds
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Confirm dialog utility
function confirmAction(message, callback) {
  if (confirm(message)) {
    callback();
  }
}

// Loading state utility
function setLoading(element, loading = true) {
  if (loading) {
    element.disabled = true;
    element.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading...';
  } else {
    element.disabled = false;
    // Restore original content (this is a simple implementation)
    element.innerHTML = element.dataset.originalText || 'Submit';
  }
}

// Initialize loading states
document.addEventListener('DOMContentLoaded', function() {
  const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"]');
  submitButtons.forEach(button => {
    button.dataset.originalText = button.innerHTML;
  });
});

// Socket.io real-time updates
if (typeof io !== 'undefined') {
  const socket = io();

  socket.on('article update', function(data) {
    // Handle real-time article updates
    console.log('Article update:', data);
    // You can implement real-time notifications here
  });

  socket.on('comment update', function(data) {
    // Handle real-time comment updates
    console.log('Comment update:', data);
    // You can implement real-time notifications here
  });
}
