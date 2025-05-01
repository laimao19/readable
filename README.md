# ReadAble

ReadAble is a web application designed to assist indivduals with dyslexia or reading difficulties to improve their reading comprehension and fluency. It provides personalized reading exercises with dynamic text simplification tailored to the user's assessed reading level.

## Project Structure

The application is divided into three main components:

1.  **Frontend (`frontend/`)**: A React-based single-page application built using `create-react-app`. It handles the user interface, user authentication via Clerk, displays exercises, and interacts with the backend API.
2.  **Backend (`backend/`)**: A Node.js/Express server that acts as the central API. It manages:
    *   User authentication sessions (using Clerk SDK).
    *   User data persistence (reading level, stats) using Prisma ORM.
    *   Fetching and preparing reading/comprehension exercises from data files.
    *   Communicating with the Simplifier Service for text processing.
    *   Serving data to the frontend.
3.  **Simplifier Service (`simplifier_service/`)**: A Python/Flask microservice dedicated to natural language processing (NLP) tasks. It receives text from the backend and simplifies it based on the user's reading level (`beginner`, `intermediate`, `advanced`). It utilizes libraries like NLTK, spaCy, and Transformers (`roberta-base`) along with custom logic to perform substitutions, considering factors like word frequency, semantic importance, and potentially patterns challenging for dyslexic readers.

## Technology Stack

*   **Frontend**: React, JavaScript, CSS, React Router, Clerk (for authentication)
*   **Backend**: Node.js, Express, Prisma, Clerk SDK
*   **Simplifier Service**: Python, Flask, NLTK, spaCy, Transformers, Pandas
*   **Database**: (Database managed by Prisma)
*   **Development/Build**: npm, Make

## Setup and Installation

**Prerequisites:**

*   Node.js and npm
*   Python and pip
*   Git (for cloning)
*   Clerk API keys set up in `.env` files (see Clerk documentation).

**Installation Steps:**

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <repository-url>
    cd readable
    ```
2.  **Install dependencies for all services:**
    This command will navigate into each service directory (`frontend`, `backend`) and run `npm install`. It will also install Python dependencies if a `requirements.txt` exists in `simplifier_service/`.
    ```bash
    make install
    ```
3.  **Set up Environment Variables:**
    *   Create a `.env` file in the `backend/` directory with your Clerk secret key and database connection string (e.g. `file:./dev.db`).
    *   Create a `.env` file in the `frontend/` directory with your Clerk publishable key.
4.  **Database Setup (Prisma):**
    *   Navigate to the `backend/` directory: `cd backend`
    *   Run Prisma migrations to set up the database schema:
        ```bash
        npx prisma migrate dev
        ```
    *   Navigate back to the root directory: `cd ..`

## Running the Application

**To start all services concurrently:**

```bash
make start-all
```

This will launch the frontend, backend, and simplifier service in parallel using the `Makefile`.

**To start services individually:**

*   **Frontend:** `make frontend` (or `cd frontend && npm start`) 
*   **Backend:** `make backend` (or `cd backend && npm start`) 
*   **Simplifier Service:** `make model` (or `cd simplifier_service && python app.py`) 

Press `Ctrl+C` in the terminal where `make start-all` was run to stop all services.

## Key Features

*   **User Authentication:** Secure login and signup managed by Clerk.
*   **Personalized Reading Levels:** Users are assigned a reading level (beginner, intermediate, advanced), determined via an the diagnostic assessment.
* **Personalized Text Display**: Depending on your reading level, for the daily exercises there are different fonts and font sizes used for better readability.
*   **Dynamic Text Simplification:** The core feature where text passages are simplified by the Python service based on the user's level.
*   **Daily Exercises:**
    *   **Reading Passages:** Provides users with text passages appropriate for their level (or the original advanced version). For beginner/intermediate users, the text is processed by the simplifier service.
    *   **Comprehension Questions:** Presents paragraphs followed by multiple-choice questions to test understanding. The paragraph difficulty is matched to the user's reading level. This text is not simplified by the NLP model simplifier service but rather taken directly from the dataset.
*   **Data-Driven Content:** Exercises are sourced from text files located in `backend/data/`, allowing for easy content updates.
    * **Sources:** OneStopEnglish corpus, OneStopQA dataset, SUBTLEX-US Frequency dataset

## Available `make` Commands

*   `make all` or `make start-all`: Installs (if needed) and starts all services.
*   `make frontend`: Starts only the frontend service.
*   `make backend`: Starts only the backend service.
*   `make model`: Starts only the Python simplifier service.
*   `make install`: Installs dependencies for frontend, backend, and Python service.
*   `make check`: Verifies if Node.js modules are installed for frontend/backend and if Python is installed.
*   `make clean`: Removes temporary Python cache files (`*.pyc`, `__pycache__`).
