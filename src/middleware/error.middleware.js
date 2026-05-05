const ErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    console.error(`[API Error] ${req.method} ${req.originalUrl}: ${message}`);
    if (err.stack) console.error(err.stack);

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        timestamp: new Date().toISOString()
    });
};

module.exports = ErrorHandler;
