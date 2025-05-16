const API_URL = 'https://web-app-five-chi.vercel.app';

// Helper: Check if user is logged in
function isLoggedIn() {
    const token = localStorage.getItem('token');
    return token && token.trim().length > 0;
}

// Helper: Get trimmed token or null
function getToken() {
    const token = localStorage.getItem('token');
    return token ? token.trim() : null;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and script running');

    // Toggle functions use class 'hidden' to show/hide elements
    window.toggleProfileMenu = function () {
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu) {
            profileMenu.classList.toggle('hidden');
        } else {
            console.error('Profile menu element not found');
        }
    };

    window.toggleCategoriesMenu = function () {
        const categoriesMenu = document.getElementById('categoriesMenu');
        if (categoriesMenu) {
            categoriesMenu.classList.toggle('hidden');
        } else {
            console.error('Categories menu element not found');
        }
    };

    window.toggleMenu = function () {
        const navMenu = document.getElementById('navMenu');
        if (navMenu) {
            navMenu.classList.toggle('hidden');
        } else {
            console.error('Nav menu element not found');
        }
    };

    // Logout function with confirmation
    window.logout = function () {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    };

    // Show/hide profile and auth buttons based on token
    const profileElement = document.querySelector('.profile');
    const authButtons = document.getElementById('authButtons');
    const commentForm = document.getElementById('commentForm');

    if (isLoggedIn()) {
        console.log('User is logged in');
        if (profileElement) profileElement.style.display = 'block';
        if (authButtons) authButtons.style.display = 'none';
        if (commentForm) commentForm.style.display = 'block';
    } else {
        console.log('User not logged in');
        if (profileElement) profileElement.style.display = 'none';
        if (authButtons) authButtons.style.display = 'block';
        if (commentForm) commentForm.style.display = 'none';
    }

    // Attach login/signup button listeners
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        window.location.href = 'login.html';
    });
    document.getElementById('signupBtn')?.addEventListener('click', () => {
        window.location.href = 'signup.html';
    });

    // Initialize Quill editor on create.html
    if (window.location.pathname.endsWith('create.html')) {
        if (typeof Quill !== 'undefined') {
            new Quill('#editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ header: [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        ['link', 'image', 'video'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['clean']
                    ]
                }
            });
            console.log('Quill editor initialized');
        } else {
            console.error('Quill library not loaded');
        }
    }

    // Sign Up handler
    if (window.location.pathname.endsWith('signup.html')) {
        const signupForm = document.getElementById('signupForm');
        signupForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            try {
                const response = await fetch(`${API_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                alert(data.message);
                if (response.status === 201) window.location.href = 'login.html';
            } catch (error) {
                console.error('Error during signup:', error);
                alert('Failed to sign up. Check the console for details.');
            }
        });
    }

    // Login handler
    if (window.location.pathname.endsWith('login.html')) {
        const loginForm = document.getElementById('loginForm');
        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            try {
                const response = await fetch(`${API_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    window.location.href = 'index.html';
                } else {
                    alert(data.message);
                }
            } catch (error) {
                console.error('Error during login:', error);
                alert('Failed to log in. Check the console for details.');
            }
        });
    }

    // Create Blog handler
    if (window.location.pathname.endsWith('create.html')) {
        const createBlogForm = document.getElementById('createBlogForm');
        createBlogForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title').value.trim();
            const category = document.getElementById('category').value.trim();
            const content = document.querySelector('.ql-editor')?.innerHTML || '';
            const token = getToken();

            if (!token) {
                alert('No token found. Please log in again.');
                window.location.href = 'login.html';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/blogs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title, category, content })
                });

                let data;
                try {
                    data = await response.json();
                } catch {
                    const text = await response.text();
                    console.error('Expected JSON but got:', text);
                    alert('Server error or invalid response.');
                    return;
                }

                if (response.status === 403 && data.message === 'Invalid token') {
                    alert('Your session has expired. Please log in again.');
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                    return;
                }

                alert(response.ok ? 'Blog created!' : `Error creating blog: ${data.message || 'Unknown error'}`);
                if (response.ok) window.location.href = 'index.html';
            } catch (error) {
                console.error('Error creating blog:', error);
                alert('Failed to create blog. Check the console for details.');
            }
        });
    }

    // Fetch and display blogs on index.html
    if (window.location.pathname.endsWith('index.html')) {
        window.fetchAndRenderBlogs = async function (category = '') {
            try {
                const response = await fetch(`${API_URL}/api/blogs${category ? `?category=${category}` : ''}`);
                const blogs = await response.json();
                console.log('Fetched Blogs:', blogs);
                const blogsList = document.getElementById('blogsList');
                if (!blogsList) return;

                blogsList.innerHTML = blogs.map(blog => `
                    <div class="blog-card">
                        <h3><a href="blog.html?id=${blog.id}">${blog.title}</a></h3>
                        <p>By ${blog.username} on ${new Date(blog.created_at).toLocaleDateString()}</p>
                        <div class="metrics">
                            <span>Likes: ${blog.likes || 0}</span>
                            <span>Comments: ${blog.comment_count || 0}</span>
                            <span>Views: ${blog.views || 0}</span>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Error fetching blogs:', error);
            }
        };
        fetchAndRenderBlogs();
    }

    // Fetch and display single blog on blog.html
    if (window.location.pathname.endsWith('blog.html')) {
        const fetchBlog = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');
            if (!blogId) return;

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}`);
                const blog = await response.json();

                document.getElementById('blogTitle').textContent = blog.title || '';
                document.getElementById('blogAuthor').textContent = blog.username || '';
                document.getElementById('blogDate').textContent = blog.created_at ? new Date(blog.created_at).toLocaleDateString() : '';
                document.getElementById('blogContent').innerHTML = blog.content || '';
                document.getElementById('likeCount').textContent = blog.likes || 0;

                const commentsList = document.getElementById('commentsList');
                const token = getToken();

                // Recursive render comments and replies
                const renderComments = (comments, parentElement) => {
                    comments.forEach(comment => {
                        const commentElement = document.createElement('div');
                        commentElement.classList.add('comment');
                        commentElement.innerHTML = `
                            <p>
                                <span class="comment-author">${comment.username}</span>
                                <span class="comment-date"> on ${new Date(comment.created_at).toLocaleDateString()}</span>
                            </p>
                            <p class="comment-content">${comment.content}</p>
                            <button class="reply-btn" id="replyBtn-${comment.id}">Reply</button>
                            <form class="reply-form hidden" id="replyForm-${comment.id}">
                                <textarea placeholder="Reply to this comment..." required></textarea>
                                <button type="submit" class="submit-btn">Reply</button>
                            </form>
                            <div class="replies"></div>
                        `;

                        // Toggle reply form
                        const replyBtn = commentElement.querySelector(`#replyBtn-${comment.id}`);
                        const replyForm = commentElement.querySelector(`#replyForm-${comment.id}`);

                        replyBtn.addEventListener('click', () => {
                            if (!token) {
                                alert('Please log in to reply to comments.');
                                window.location.href = 'login.html';
                                return;
                            }
                            replyForm.classList.toggle('hidden');
                        });

                        // Handle reply submit
                        replyForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const replyContent = replyForm.querySelector('textarea').value.trim();
                            if (!replyContent) {
                                alert('Reply cannot be empty.');
                                return;
                            }

                            try {
                                const response = await fetch(`${API_URL}/api/blogs/${blogId}/comments/reply`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ content: replyContent, parent_id: comment.id })
                                });

                                let data;
                                try {
                                    data = await response.json();
                                } catch {
                                    const text = await response.text();
                                    console.error('Expected JSON but got:', text);
                                    alert('Server error or invalid response.');
                                    return;
                                }

                                if (response.status === 403 && data.message === 'Invalid token') {
                                    alert('Your session has expired. Please log in again.');
                                    localStorage.removeItem('token');
                                    window.location.href = 'login.html';
                                    return;
                                }

                                if (response.ok) {
                                    alert('Reply posted!');
                                    window.location.reload();
                                } else {
                                    alert(data.message || 'Failed to post reply');
                                }
                            } catch (error) {
                                console.error('Error posting reply:', error);
                                alert('Failed to post reply. Check the console for details.');
                            }
                        });

                        // Recursively render replies
                        if (comment.replies && comment.replies.length > 0) {
                            renderComments(comment.replies, commentElement.querySelector('.replies'));
                        }

                        parentElement.appendChild(commentElement);
                    });
                };

                // Clear and render comments
                if (commentsList) {
                    commentsList.innerHTML = '';
                    if (blog.comments && blog.comments.length > 0) {
                        renderComments(blog.comments, commentsList);
                    }
                }
            } catch (error) {
                console.error('Error fetching blog:', error);
            }
        };

        fetchBlog();

        // Comment form submission
        const commentForm = document.getElementById('commentForm');
        commentForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const commentInput = document.getElementById('commentInput');
            const content = commentInput.value.trim();
            if (!content) {
                alert('Comment cannot be empty.');
                return;
            }

            const token = getToken();
            if (!token) {
                alert('Please log in to comment.');
                window.location.href = 'login.html';
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');
            if (!blogId) return;

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ content })
                });

                let data;
                try {
                    data = await response.json();
                } catch {
                    const text = await response.text();
                    console.error('Expected JSON but got:', text);
                    alert('Server error or invalid response.');
                    return;
                }

                if (response.status === 403 && data.message === 'Invalid token') {
                    alert('Your session has expired. Please log in again.');
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                    return;
                }

                if (response.ok) {
                    alert('Comment posted!');
                    window.location.reload();
                } else {
                    alert(data.message || 'Failed to post comment');
                }
            } catch (error) {
                console.error('Error posting comment:', error);
                alert('Failed to post comment. Check the console for details.');
            }
        });

        // Like button handler
        document.getElementById('likeButton')?.addEventListener('click', async () => {
            const token = getToken();
            if (!token) {
                alert('Please log in to like posts.');
                window.location.href = 'login.html';
                return;
            }
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');
            if (!blogId) return;

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}/like`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                if (response.status === 403 && data.message === 'Invalid token') {
                    alert('Your session has expired. Please log in again.');
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                    return;
                }

                if (response.ok) {
                    alert(data.message || 'Liked the post!');
                    // Update like count displayed
                    const likeCountEl = document.getElementById('likeCount');
                    if (likeCountEl) {
                        likeCountEl.textContent = (parseInt(likeCountEl.textContent) || 0) + 1;
                    }
                } else {
                    alert(data.message || 'Failed to like post');
                }
            } catch (error) {
                console.error('Error liking post:', error);
                alert('Failed to like post. Check the console for details.');
            }
        });
    }
});
